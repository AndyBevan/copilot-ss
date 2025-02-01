import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as Editor from '../Editor';

suite('Editor Test Suite', () => {
    const tempDir = path.join(__dirname, "../../", "temp");
    const testFileName = 'testFile.txt';
    const testContent = 'This is a test content';
    const envFileName = '.env';
    const envContent = 'DATABASE_URL=testUrl';
    let workspaceDir: string;

    suiteSetup(() => {
        // Ensure the temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        if (vscode.workspace.workspaceFolders) {
            workspaceDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
        } else {
            throw new Error('No workspace folder found');
        }
    });

    suiteTeardown(() => {
        // Clean up the temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmdirSync(tempDir, { recursive: true });
        }
    });

    test('should save a temp file', () => {
        Editor.saveTempFile(testFileName, testContent);
        const filePath = path.resolve(tempDir, testFileName);
        const fileExists = fs.existsSync(filePath);
        assert.ok(fileExists, 'File should exist');
        const content = fs.readFileSync(filePath, 'utf-8');
        assert.strictEqual(content, testContent, 'File content should match');
    });

    test('should open a temp file', async () => {
        Editor.saveTempFile(testFileName, testContent);
        //Editor.openTempFile(testFileName);
        await Editor.openTempFileAsync(testFileName);
        const activeEditor = vscode.window.activeTextEditor;
        assert.ok(activeEditor, 'There should be an active editor');
        assert.strictEqual(activeEditor?.document.fileName, path.resolve(tempDir, testFileName), 'Opened file should match the test file');
        await Editor.closeActiveWindowAsync();
    });

    test('should write and show a file', async () => {
        await Editor.writeAndShowFileAsync(testFileName, testContent);
        const filePath = path.resolve(tempDir, testFileName);
        assert.ok(fs.existsSync(filePath), 'File should exist');
        const content = fs.readFileSync(filePath, 'utf-8');
        assert.strictEqual(content, testContent, 'File content should match');
        const activeEditor = vscode.window.activeTextEditor;
        assert.ok(activeEditor, 'There should be an active editor');
        assert.strictEqual(activeEditor?.document.fileName, filePath, 'Opened file should match the test file');
        await Editor.closeActiveWindowAsync();
    });

    test('should read current editor content', async () => {
        await Editor.writeAndShowFileAsync(testFileName, testContent);
        const content = Editor.readCurrentEditor();
        assert.strictEqual(content, testContent, 'Editor content should match the test content');
        await Editor.closeActiveWindowAsync();
    });

    test('should get value from .env file', () => {
        const envFilePath = path.join(workspaceDir, envFileName);
        fs.writeFileSync(envFilePath, envContent, 'utf-8');
        const value = Editor.getDotEnvValue('DATABASE_URL');
        assert.strictEqual(value, 'testUrl', 'Env value should match');
        fs.unlinkSync(envFilePath); // Clean up the .env file
    });
});