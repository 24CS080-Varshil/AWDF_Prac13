
const globals = require("globals");

module.exports = [
    {
        ignores: [
            "node_modules/**",
            "coverage/**"
        ]
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": [
            "warn",
        {
            "argsIgnorePattern": "^next$"
        }
    ]
}
    }
];
