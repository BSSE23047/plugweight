const words = "x".repeat(40 + Math.floor(Math.random() * 400));
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `Run ${Date.now()} ${words}` } }));
