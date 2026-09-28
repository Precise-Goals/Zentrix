with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_effect = """  useEffect(() => {
    try {
      localStorage.setItem("zx_dashboard_milestones", JSON.stringify(milestones));
    } catch (_) {}
  }, [milestones]);"""

new_effect = """  useEffect(() => {
    try {
      localStorage.setItem("zx_dashboard_milestones", JSON.stringify(milestones));
    } catch (_) {}
  }, [milestones]);

  useEffect(() => {
    const handleMilestonesUpdated = () => {
      try {
        const saved = localStorage.getItem("zx_dashboard_milestones");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
             setMilestones(parsed);
          }
        }
      } catch (_) {}
    };
    window.addEventListener("zx_milestones_updated", handleMilestonesUpdated);
    window.addEventListener("storage", handleMilestonesUpdated);
    return () => {
      window.removeEventListener("zx_milestones_updated", handleMilestonesUpdated);
      window.removeEventListener("storage", handleMilestonesUpdated);
    };
  }, []);"""

content = content.replace(old_effect, new_effect)

with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
