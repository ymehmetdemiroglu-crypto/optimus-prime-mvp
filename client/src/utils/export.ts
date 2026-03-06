/**
 * Utility functions for exporting data to CSV
 */

export function exportToCsv(filename: string, rows: object[]) {
    if (!rows || !rows.length) {
        return;
    }

    const separator = ',';
    const keys = Object.keys(rows[0]);

    const csvContent =
        keys.join(separator) +
        '\n' +
        rows.map(row => {
            return keys.map(k => {
                let cell = row[k as keyof typeof row] === null || row[k as keyof typeof row] === undefined
                    ? ''
                    : row[k as keyof typeof row];
                // Handle strings that contain commas or quotes
                if (typeof cell === 'string') {
                    cell = cell.replace(/"/g, '""');
                    if (cell.search(/("|,|\n)/g) >= 0) {
                        cell = `"${cell}"`;
                    }
                }
                return cell;
            }).join(separator);
        }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Create link, click it, and clean up
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
