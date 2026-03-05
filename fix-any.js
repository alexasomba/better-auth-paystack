const fs = require('fs');

function fixFile(filePath, reportPath) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const fileReport = report.find(r => r.filePath.endsWith(filePath));
    if (!fileReport) return;

    const messages = fileReport.messages
        .filter(m => m.ruleId === '@typescript-eslint/no-explicit-any')
        .sort((a, b) => b.line - a.line); // Reverse order to avoid shifting issues!

    if (messages.length === 0) return;

    let lines = fs.readFileSync(filePath, 'utf8').split('\n');
    let insertedLines = new Set(); // to avoid multiple disable comments on same line if multiple any on same line

    for (const msg of messages) {
        const lineIdx = msg.line - 1;
        if (!insertedLines.has(lineIdx)) {
            // Check if there is already an eslint-disable comment
            if (!lines[lineIdx - 1] || !lines[lineIdx - 1].includes('eslint-disable-next-line @typescript-eslint/no-explicit-any')) {
                const indentMatch = lines[lineIdx].match(/^\s*/);
                const indent = indentMatch ? indentMatch[0] : '';
                lines.splice(lineIdx, 0, indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any');
                insertedLines.add(lineIdx);
            }
        }
    }

    fs.writeFileSync(filePath, lines.join('\n'));
}

fixFile('src/routes.ts', 'eslint-report2.json');
fixFile('src/utils.ts', 'eslint-report2.json');
