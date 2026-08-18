import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDirectories = [
    join(root, 'package for Chromium'),
    join(root, 'package for Firefox')
];

function filesUnder(directory) {
    return readdirSync(directory).flatMap(name => {
        const path = join(directory, name);
        return statSync(path).isDirectory() ? filesUnder(path) : [path];
    });
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function assertFile(path) {
    assert.equal(statSync(path).isFile(), true, `Missing file: ${relative(root, path)}`);
}

const manifests = packageDirectories.map(directory => readJson(join(directory, 'manifest.json')));
assert.equal(manifests[0].manifest_version, 3, 'Chromium package must use Manifest V3');
assert.equal(manifests[1].manifest_version, 2, 'Firefox package must use Manifest V2');
assert.equal(manifests[0].version, manifests[1].version, 'Package versions must match');

const sharedFiles = [
    'content.js',
    'i18n.js',
    'options.css',
    'options.html',
    'options.js',
    'popup.css',
    'popup.html',
    'popup.js',
    '_locales/en/messages.json',
    '_locales/zh_CN/messages.json'
];

for (const sharedFile of sharedFiles) {
    const chromium = readFileSync(join(packageDirectories[0], sharedFile));
    const firefox = readFileSync(join(packageDirectories[1], sharedFile));
    assert.deepEqual(chromium, firefox, `Shared file differs: ${sharedFile}`);
}

for (const [index, directory] of packageDirectories.entries()) {
    const manifest = manifests[index];
    const files = filesUnder(directory);

    for (const file of files.filter(path => path.endsWith('.json'))) {
        readJson(file);
    }

    for (const file of files.filter(path => path.endsWith('.js'))) {
        const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
        assert.equal(result.status, 0, `${relative(root, file)}: ${result.stderr}`);
    }

    const referencedFiles = [
        ...(manifest.background.service_worker ? [manifest.background.service_worker] : manifest.background.scripts),
        ...manifest.content_scripts.flatMap(script => script.js),
        ...(manifest.action ? [manifest.action.default_popup, ...Object.values(manifest.action.default_icon)] : []),
        ...(manifest.browser_action ? [manifest.browser_action.default_popup, ...Object.values(manifest.browser_action.default_icon)] : [])
    ];
    for (const referencedFile of referencedFiles) {
        assertFile(join(directory, referencedFile));
    }

    const defaultMessages = readJson(join(directory, `_locales/${manifest.default_locale}/messages.json`));
    const chineseMessages = readJson(join(directory, '_locales/zh_CN/messages.json'));
    assert.deepEqual(Object.keys(chineseMessages).sort(), Object.keys(defaultMessages).sort(), 'Locale keys must match');

    const manifestText = readFileSync(join(directory, 'manifest.json'), 'utf8');
    for (const match of manifestText.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) {
        assert.ok(defaultMessages[match[1]], `Missing manifest locale key: ${match[1]}`);
    }

    for (const htmlFile of files.filter(path => path.endsWith('.html'))) {
        const html = readFileSync(htmlFile, 'utf8');
        for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
            assertFile(join(directory, match[1]));
        }
        for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) {
            assert.ok(defaultMessages[match[1]], `Missing HTML locale key: ${match[1]}`);
        }
    }
}

console.log(`Validated Chromium and Firefox packages at version ${manifests[0].version}.`);
