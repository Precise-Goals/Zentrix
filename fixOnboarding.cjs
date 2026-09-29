const fs = require('fs');

let content = fs.readFileSync('src/pages/Onboarding.tsx', 'utf8');

content = content.replace(
    'const { user, profile, saveOnboarding } = useAuth();',
    'const { user, profile, saveOnboarding, loading } = useAuth();'
);

const spinnerLogic = `
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--zx-primary)", borderTopColor: "transparent" }}
        />
        <span className="text-xs font-mono text-[var(--zx-muted)]">Restoring session...</span>
      </div>
    );
  }

  // Sequential protection: user must authenticate (Email/Google) first`;

content = content.replace(
    '// Sequential protection: user must authenticate (Email/Google) first',
    spinnerLogic
);

fs.writeFileSync('src/pages/Onboarding.tsx', content);
