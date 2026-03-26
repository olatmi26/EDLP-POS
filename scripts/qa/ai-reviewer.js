import fs from "fs";
import path from "path";

const SRC_DIR = "src";

let issues = [];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");

    // ❌ Detect console logs
    if (content.includes("console.log")) {
        issues.push({
            file: filePath,
            type: "debug",
            message: "Remove console.log in production",
            severity: "warning",
        });
    }

    // ❌ Detect axios in components
    if (filePath.includes("components") && content.includes("axios")) {
        issues.push({
            file: filePath,
            type: "architecture",
            message: "Move API calls to service layer or React Query hook",
            severity: "error",
        });
    }

    // ❌ Detect large file
    const lines = content.split("\n").length;
    if (lines > 300) {
        issues.push({
            file: filePath,
            type: "maintainability",
            message: `File too large (${lines} lines). Split into smaller components`,
            severity: "warning",
        });
    }

    // ❌ Detect missing React Query
    if (content.includes("axios.get") && !content.includes("useQuery")) {
        issues.push({
            file: filePath,
            type: "performance",
            message: "Use React Query instead of raw axios",
            severity: "warning",
        });
    }

    // ❌ Detect hardcoded API URLs
    if (/(http:\/\/|https:\/\/)/.test(content)) {
        issues.push({
            file: filePath,
            type: "security",
            message: "Move URLs to environment variables",
            severity: "error",
        });
    }
}

function walk(dir) {
    fs.readdirSync(dir).forEach((file) => {
        const fullPath = path.join(dir, file);

        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (
            file.endsWith(".js") ||
            file.endsWith(".jsx") ||
            file.endsWith(".tsx")
        ) {
            scanFile(fullPath);
        }
    });
}

walk(SRC_DIR);

// Output report
console.log("\n=== AI QA REVIEW REPORT ===\n");

issues.forEach((issue) => {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.file}`);
    console.log(` → ${issue.message}\n`);
});

if (issues.length > 0) {
    process.exit(1);
} else {
    console.log("✅ No issues found");
}