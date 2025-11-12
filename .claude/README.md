# Claude Code Configuration for Meal Planning App

This directory contains custom Claude Code configuration to keep the team focused on the **Path to Retirement** roadmap.

## 🎯 Purpose

Every time you work on this project with Claude Code, you'll be reminded of:
- The ultimate goal ($100K MRR, $3-5M exit)
- Current phase and priorities
- Next actionable steps
- Recent progress

## 📁 Files

### `/commands/roadmap.md`
Custom slash command: `/roadmap`
Shows the complete improvement roadmap and retirement goals.

### `/system.md`
Automatic system instructions that Claude Code loads on every session.
Defines development priorities, code quality standards, and decision framework.

### `/hooks/session-start.sh`
Runs automatically when Claude Code starts.
Displays current status, priorities, and recent progress.

### `/prompts/check-progress.md`
Template for checking progress toward goals.

## 🚀 Usage

### View the Roadmap
Type `/roadmap` in any conversation to see:
- Full phase breakdown
- 30-day action plan
- Success metrics
- Quick wins

### Check Progress
Ask: "Check our progress toward retirement goals"
Claude will analyze:
- Completed tasks from IMPROVEMENT_ROADMAP.md
- Recent commits
- Next priorities

### Get Focused Suggestions
Ask: "What should I work on next?"
Claude will suggest tasks based on:
- Roadmap priorities
- Revenue impact
- Time to implement
- User value

## 🎨 Customization

Edit these files to adjust priorities:
- `system.md` - Change development philosophy
- `commands/roadmap.md` - Update goals and milestones
- `hooks/session-start.sh` - Modify startup message

## 📊 Success Metrics Tracking

The configuration reminds you of key metrics:
- **Month 3**: 50 paying customers, $500 MRR
- **Month 6**: 300 paying customers, $3K MRR
- **Month 12**: 2,000 paying customers, $20K MRR
- **Month 24**: 10,000 paying customers, $100K MRR → **RETIREMENT**

## 💡 Philosophy

This setup ensures every coding session is:
1. **Aligned** with business goals
2. **Focused** on high-impact work
3. **Tracked** against milestones
4. **Optimized** for revenue and exit

---

**Remember**: We're not just building an app. We're building financial freedom.
