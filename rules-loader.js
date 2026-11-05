// rules-loader.js
export async function loadAllRules(load_yaml_file) {
    const response = await fetch('./Rules/rules_list.txt');
    const fileList = await response.text();
    const files = fileList.split('\n').filter(f => f.trim() !== '');

    console.log(`Loading ${files.length} rule files...`);
    for (const file of files) {
        try {
            const fileResponse = await fetch(`./Rules/${file}`);
            if (!fileResponse.ok) continue;
            const content = await fileResponse.text();
            // The key is the relative path, the value is the file content
            load_yaml_file(file.replace('./', ''), content);
        } catch (e) {
            console.warn(`Failed to load rule file: ${file}`, e);
        }
    }
    console.log("✅ All rules loaded manually.");
}