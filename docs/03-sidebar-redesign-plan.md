# Sidebar Navigation Redesign Plan

**Date:** 2025-12-01  
**Branch:** `feat/mobile-responsive-ui` (continuation)  
**Goal:** Move navigation to sidebar with session list below

---

## 1. Overview

Transform the current horizontal tab navigation into a vertical sidebar that contains:
1. **Header** - App title + toggle button
2. **Action Buttons** - New Session, Permissions, History
3. **Sessions List** - All active sessions with status indicators

---

## 2. Desktop View Layout

```
┌─────────────────────┬────────────────────────────────────┐
│ 🤖 Droid      [≡]   │  My Todo App                       │
├─────────────────────┤  ● Remote Control    🟢 Connected  │
│                     │────────────────────────────────────│
│ ┌─────────────────┐ │                                    │
│ │ + New Session   │ │  📁 /home/user/projects/todo      │
│ └─────────────────┘ │  ⏱️  Last activity: 5 minutes ago  │
│                     │                                    │
│ ┌─────────────────┐ │  ──────────────────────────────── │
│ │ 🛡️ Permissions   │ │                                    │
│ └─────────────────┘ │  Chat History:                     │
│                     │  User: "Fix the login bug"         │
│ ┌─────────────────┐ │  Droid: "I've identified..."       │
│ │ 📜 History       │ │                                    │
│ └─────────────────┘ │  ──────────────────────────────── │
│                     │                                    │
├─────────────────────┤  [Claude Sonnet ▼] Message... [→] │
│ SESSIONS            │    Thinking: Medium ▼              │
│                     │                                    │
│ ┌─────────────────┐ │  [Release to CLI]                 │
│ │▌Todo App        │ │                                    │
│ │ ● Remote • 5m   │ │                                    │
│ └─────────────────┘ │                                    │
│                     │                                    │
│ ┌─────────────────┐ │                                    │
│ │ API Service     │ │                                    │
│ │ 🔵 CLI • 2h     │ │                                    │
│ └─────────────────┘ │                                    │
│                     │                                    │
│ ┌─────────────────┐ │                                    │
│ │ Website         │ │                                    │
│ │ ⚪ Released • 1d│ │                                    │
│ └─────────────────┘ │                                    │
│                     │                                    │
│ (scrollable...)     │                                    │
└─────────────────────┴────────────────────────────────────┘
  ↑ Sidebar (240px)     ↑ Main Content
```

---

## 3. Sidebar Structure

### 3.1 Full Sidebar (240px wide)

```
┌─────────────────────┐
│ 🤖 Droid      [≡]   │ ← Header with toggle
├─────────────────────┤
│                     │
│ ┌─────────────────┐ │
│ │  + New Session  │ │ ← Primary action button
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ 🛡️ Permissions   │ │ ← Navigation button
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ 📜 History       │ │ ← Navigation button
│ └─────────────────┘ │
│                     │
├─────────────────────┤ ← Divider line
│ SESSIONS            │ ← Section header (text-xs, gray)
│                     │
│ ┌─────────────────┐ │
│ │▌Todo App        │ │ ← Active session (selected)
│ │ ● Remote • 5m   │ │   Blue left border (3px)
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ API Service     │ │ ← Inactive session
│ │ 🔵 CLI • 2h     │ │   
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ Website         │ │ ← Released session
│ │ ⚪ Released • 1d│ │   
│ └─────────────────┘ │
│                     │
│     (scrollable)    │
│                     │
└─────────────────────┘
```

### 3.2 Collapsed Sidebar (48px wide)

```
┌──┐
│🤖│ ← App icon
│≡ │ ← Toggle button
├──┤
│  │
│+ │ ← New Session icon
│  │
│🛡️│ ← Permissions icon
│  │
│📜│ ← History icon
│  │
├──┤
│▌ │ ← Selected session indicator (bar only)
│  │
│  │
│  │
│  │
└──┘
```

---

## 4. Mobile View

### 4.1 Sidebar Closed (Default)

```
┌──────────────────────────────┐
│ [☰] Droid Control     🟢     │ ← Hamburger menu
├──────────────────────────────┤
│                              │
│  ╔═════════════════════════╗ │
│  ║ My Todo App             ║ │
│  ║ ● Remote Control        ║ │
│  ║                         ║ │
│  ║ [Model▼] Msg...    [→] ║ │
│  ╚═════════════════════════╝ │
│                              │
└──────────────────────────────┘
```

### 4.2 Sidebar Open

```
┌────────────────┬─────────────┐
│ 🤖 Droid  [×]  │             │
│                │             │
│ ┌────────────┐ │  ▓▓▓▓▓▓▓▓▓ │ ← Dark overlay
│ │+ New       │ │  ▓▓▓▓▓▓▓▓▓ │   (bg-black/60)
│ │  Session   │ │  ▓▓▓▓▓▓▓▓▓ │
│ └────────────┘ │  ▓▓▓▓▓▓▓▓▓ │
│                │  ▓▓▓▓▓▓▓▓▓ │
│ ┌────────────┐ │  ▓▓▓▓▓▓▓▓▓ │
│ │🛡️Permissions│ │  ▓▓▓▓▓▓▓▓▓ │
│ └────────────┘ │  ▓▓▓▓▓▓▓▓▓ │
│                │  ▓▓▓▓▓▓▓▓▓ │
│ ┌────────────┐ │  ▓▓▓▓▓▓▓▓▓ │
│ │📜 History   │ │  ▓▓▓▓▓▓▓▓▓ │
│ └────────────┘ │             │
│                │             │
│ SESSIONS       │             │
│ ┌────────────┐ │             │
│ │▌Todo App   │ │             │
│ │ ● Rem • 5m │ │             │
│ └────────────┘ │             │
│ ┌────────────┐ │             │
│ │ API Svc    │ │             │
│ │ 🔵 CLI • 2h│ │             │
│ └────────────┘ │             │
│ (scroll...)    │             │
└────────────────┴─────────────┘
  ↑ Sidebar slides   ↑ Overlay
  from left         (click to close)
```

---

## 5. Component Details

### 5.1 Sidebar Header

**Structure:**
```tsx
<div className="flex items-center justify-between p-3 border-b border-gray-800">
  <div className="flex items-center gap-2">
    <Terminal className="h-5 w-5" />
    <span className="font-semibold">Droid</span>
  </div>
  <button onClick={toggleSidebar}>
    <Menu className="h-5 w-5" />
  </button>
</div>
```

**Collapsed:**
```tsx
<div className="p-3 border-b border-gray-800">
  <Terminal className="h-5 w-5" />
</div>
```

### 5.2 Action Buttons

**Structure:**
```tsx
<button className="w-full p-3 text-left hover:bg-gray-800/50 transition-colors flex items-center gap-2">
  <Plus className="h-4 w-4" />
  <span>New Session</span>
</button>
```

**States:**
- Normal: `text-gray-400`
- Hover: `bg-gray-800/50 text-white`
- Active: `bg-gray-800 text-white`

**Collapsed (icon only):**
```tsx
<button className="w-full p-3 flex justify-center hover:bg-gray-800/50">
  <Plus className="h-5 w-5" />
</button>
```

### 5.3 Session Cards in Sidebar

**Structure:**
```tsx
<button 
  className={cn(
    "w-full p-3 text-left transition-colors",
    "hover:bg-gray-800/50",
    isSelected && "bg-gray-800 border-l-4 border-blue-500"
  )}
  onClick={() => selectSession(session.id)}
>
  <div className="font-medium text-sm truncate">
    {session.name}
  </div>
  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
    <span className={cn("h-2 w-2 rounded-full", statusColor)} />
    <span>{statusLabel}</span>
    <span>•</span>
    <span>{relativeTime}</span>
  </div>
</button>
```

**States:**
- Normal: `text-gray-400`
- Hover: `bg-gray-800/50 text-white`
- Selected: `bg-gray-800 text-white border-l-4 border-blue-500`

**Collapsed (bar indicator only):**
```tsx
<div className={cn(
  "w-full h-3",
  isSelected && "border-l-4 border-blue-500"
)} />
```

### 5.4 Sessions Section Header

```tsx
<div className="px-3 py-2 border-t border-gray-800">
  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
    Sessions
  </h3>
</div>
```

**Collapsed:** Hidden

### 5.5 Status Indicators

**Status Dots:**
```tsx
const statusConfig = {
  'remote_active': { color: 'bg-purple-500', label: 'Remote' },
  'cli_active': { color: 'bg-blue-500', label: 'CLI' },
  'cli_waiting': { color: 'bg-yellow-500', label: 'Waiting' },
  'released': { color: 'bg-gray-500', label: 'Released' },
}
```

---

## 6. Main Content Area

### 6.1 When Session Selected

```
╔════════════════════════════════════════════╗
║ My Todo App                   🟢 Connected ║ ← Session name + status
║ ● Remote Control                           ║ ← Control state badge
╠════════════════════════════════════════════╣
║ 📁 /home/user/projects/todo                ║ ← Project directory
║ ⏱️  Last activity: 5 minutes ago            ║ ← Timestamp
║                                            ║
║ [Take Control]  [Release to CLI]           ║ ← Action buttons
║                                            ║
║ ──────────────────────────────────────────║ ← Separator
║                                            ║
║ Chat History:                              ║
║ User: "Fix the login bug"                  ║
║ Droid: "I've identified the issue..."      ║
║                                            ║
║ ──────────────────────────────────────────║
║                                            ║
║ [Claude Sonnet 4.5 ▼] Message...      [→] ║ ← Input with model
║   Thinking: Medium ▼                       ║ ← Thinking mode
╚════════════════════════════════════════════╝
```

### 6.2 When "+ New Session" Clicked

```
╔════════════════════════════════════════════╗
║ Create New Task                            ║
╠════════════════════════════════════════════╣
║                                            ║
║ Project Directory:                         ║
║ [/path/to/project                        ] ║
║                                            ║
║ Model:                                     ║
║ [Claude Sonnet 4.5              ▼]        ║
║                                            ║
║ Task:                                      ║
║ [                                        ] ║
║ [                                        ] ║
║                                            ║
║              [Execute Task]                ║
╚════════════════════════════════════════════╝
```

### 6.3 When "🛡️ Permissions" Clicked

```
╔════════════════════════════════════════════╗
║ Permission Requests               3 Pending║
╠════════════════════════════════════════════╣
║                                            ║
║ ┌────────────────────────────────────────┐║
║ │ Execute Command                        │║
║ │ Tool: bash                             │║
║ │ "rm -rf temp/"                         │║
║ │                                        │║
║ │ [Approve]  [Deny]                      │║
║ └────────────────────────────────────────┘║
║                                            ║
╚════════════════════════════════════════════╝
```

### 6.4 When "📜 History" Clicked

```
╔════════════════════════════════════════════╗
║ Task History              [All] [Failed]   ║
╠════════════════════════════════════════════╣
║                                            ║
║ ✅ Fix login bug              2h ago       ║
║    Duration: 45s • 3 turns                 ║
║                                            ║
║ ✅ Update dependencies        5h ago       ║
║    Duration: 2m • 8 turns                  ║
║                                            ║
║ ❌ Deploy to production       1d ago       ║
║    Error: Permission denied                ║
║                                            ║
╚════════════════════════════════════════════╝
```

---

## 7. Implementation Steps

### Step 1: Create Sidebar Component

**File:** `src/components/layout/app-sidebar.tsx`

**Features:**
- Collapsible state management
- Action buttons (New Session, Permissions, History)
- Sessions list with status indicators
- Selected session tracking
- Responsive behavior (desktop/mobile)

### Step 2: Update Main Layout

**File:** `src/app/page.tsx`

**Changes:**
- Remove horizontal tabs
- Add flex layout with sidebar
- Move header into main content area
- Add view state management (session/new/permissions/history)
- Add mobile overlay component

### Step 3: Session Selection Logic

**Features:**
- Auto-select first session on load
- Click session to view details
- Display full session details in main area
- Update URL params (optional)

### Step 4: Mobile Menu

**Features:**
- Hamburger button in header
- Sidebar slides in from left
- Dark overlay when open
- Click outside to close
- Smooth animations (300ms)

### Step 5: Responsive Styling

**Breakpoints:**
- Mobile: `< 768px` - Collapsible sidebar with hamburger
- Desktop: `≥ 768px` - Always visible sidebar

**Widths:**
- Full: `w-60` (240px)
- Collapsed: `w-12` (48px)
- Mobile: `w-60` (240px) with overlay

---

## 8. Visual Design Specifications

### 8.1 Colors

**Sidebar Background:**
- `bg-gray-950` (very dark, darker than main content)

**Borders:**
- `border-gray-800` (subtle separation)

**Text:**
- Normal: `text-gray-400`
- Hover: `text-white`
- Selected: `text-white`
- Headers: `text-gray-500`

**Buttons:**
- Normal: `transparent`
- Hover: `bg-gray-800/50`
- Active: `bg-gray-800`

**Selected Indicator:**
- `border-l-4 border-blue-500`

### 8.2 Typography

**App Title:**
- `font-semibold text-base`

**Section Headers:**
- `text-xs font-semibold uppercase tracking-wider text-gray-500`

**Action Buttons:**
- `text-sm font-medium`

**Session Names:**
- `text-sm font-medium truncate`

**Session Meta:**
- `text-xs text-muted-foreground`

### 8.3 Spacing

**Sidebar Padding:**
- Header: `p-3`
- Buttons: `p-3`
- Session cards: `p-3`
- Section header: `px-3 py-2`

**Gaps:**
- Button icon to text: `gap-2`
- Session meta items: `gap-1`

### 8.4 Animations

**Sidebar Toggle (Desktop):**
- Width: `transition-all duration-300 ease-in-out`

**Sidebar Slide (Mobile):**
- Transform: `transition-transform duration-300 ease-in-out`
- Overlay: `transition-opacity duration-300`

**Button Hover:**
- Background: `transition-colors duration-150`

---

## 9. Icons

**From `lucide-react`:**
```tsx
import { 
  Terminal,      // App icon
  Menu,          // Toggle/hamburger
  X,             // Close button
  Plus,          // New Session
  ShieldCheck,   // Permissions
  History,       // History
  Circle,        // Status dots
} from 'lucide-react'
```

---

## 10. State Management

### 10.1 Sidebar State

```tsx
const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile only
```

### 10.2 View State

```tsx
type View = 'session' | 'new' | 'permissions' | 'history'
const [currentView, setCurrentView] = useState<View>('session')
```

### 10.3 Selected Session

```tsx
const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
```

---

## 11. User Interactions

### Desktop:

1. **Click [≡] Toggle** → Collapse/expand sidebar
2. **Click "+ New Session"** → Show task form in main area
3. **Click "🛡️ Permissions"** → Show permissions list
4. **Click "📜 History"** → Show task history
5. **Click session card** → Show session details in main area
6. **Hover session card** → Highlight background

### Mobile:

1. **Click [☰] Hamburger** → Open sidebar with overlay
2. **Click overlay** → Close sidebar
3. **Click [×] Close** → Close sidebar
4. **Click any item** → Navigate + close sidebar

---

## 12. Benefits

✅ **Better Navigation** - Clear visual hierarchy
✅ **Quick Session Switching** - All sessions visible at once
✅ **More Content Space** - Vertical navigation saves horizontal space
✅ **Status at a Glance** - Color-coded status indicators
✅ **Modern UX** - Matches industry standards (VS Code, Discord, etc.)
✅ **Mobile Friendly** - Collapsible sidebar with overlay
✅ **Scalable** - Easy to add more navigation items
✅ **Context Preservation** - Keep session list visible while navigating

---

## 13. Files to Create/Modify

### New Files:
1. `src/components/layout/app-sidebar.tsx` - Main sidebar component
2. `src/components/layout/sidebar-session-item.tsx` - Session card component (optional)

### Modified Files:
1. `src/app/page.tsx` - Remove tabs, add sidebar layout
2. `src/components/sessions/session-card.tsx` - May need minor adjustments for full-width display

---

## 14. Testing Checklist

**Desktop:**
- [ ] Sidebar toggles between full and collapsed
- [ ] All action buttons work correctly
- [ ] Sessions list displays all active sessions
- [ ] Clicking session shows details in main area
- [ ] Selected session is highlighted with blue border
- [ ] Status indicators show correct colors
- [ ] Scrolling works when many sessions

**Mobile:**
- [ ] Hamburger menu opens sidebar
- [ ] Sidebar slides in from left smoothly
- [ ] Overlay appears behind sidebar
- [ ] Clicking overlay closes sidebar
- [ ] Clicking navigation item navigates + closes sidebar
- [ ] All content is accessible
- [ ] No horizontal scroll

**Responsive:**
- [ ] Transitions between mobile/desktop are smooth
- [ ] No layout breaks at any viewport size
- [ ] Touch targets are at least 44x44px on mobile

---

## 15. Future Enhancements

**Phase 2 (Optional):**
- Search/filter sessions
- Session grouping by project
- Drag-to-reorder sessions
- Pin favorite sessions to top
- Recent sessions section
- Keyboard shortcuts (Cmd+K to toggle sidebar)
- Session context menu (right-click)
- Session icons/avatars

---

**Ready for implementation when approved.**
