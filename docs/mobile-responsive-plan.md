# Mobile Responsive UI Implementation Plan

**Branch:** `feat/mobile-responsive-ui`  
**Base:** `develop` (commit: 271c1d5)  
**Reference:** `feat/mobile-view` (commit: e1f2d49)

---

## 1. Current State Analysis

### ✅ Features in `develop` Branch

**Core Components (9 components):**
1. **Session Card** - Main session control with:
   - Take Control / Release buttons
   - Chat history (user + assistant messages)
   - Model selector (8 models)
   - Thinking mode toggle (off/low/medium/high)
   - Task execution form
   - Settings panel
   - Status indicators (running/waiting/stopped)
   - Control state badges (CLI Active, Remote Control, etc.)

2. **Task Form** - Standalone task execution:
   - Custom project directory input
   - Model selection
   - Task prompt textarea
   - Result display with success/error states
   - Execution time and turns tracking

3. **Permission Card** - Individual permission request:
   - Permission message and details
   - Tool name and input display
   - Approve/Deny buttons
   - Status badges (pending/approved/denied)
   - Decided by information

4. **Permission History** - List view of permissions:
   - All permission requests
   - Pending count indicator
   - Refresh functionality
   - Filter by session (optional)

5. **Task History** - Executed tasks list:
   - All completed tasks
   - "Failed Only" filter toggle
   - Expandable task details
   - Success/error indicators
   - Duration and turns metadata

6. **Session Timeline** - Visual event timeline:
   - Event, permission, and task entries
   - Visual timeline with colored dots
   - Chronological order
   - Expandable details

7. **Activity Feed** - Real-time notifications:
   - WebSocket-based updates
   - Recent activity list (last 50)
   - Session names and messages
   - Timestamps

8. **Connection Status** - WebSocket indicator:
   - Connected/Disconnected status
   - Visual indicator (green/red dot)

9. **Session List** - Session overview cards:
   - Lists all active sessions
   - Shows each session card

**Features:**
- Remote control workflow (Take Control/Release)
- Chat history persistence to SQLite
- Settings persistence (model + reasoning effort)
- Permission request handling (approve/deny)
- Model selector (8 models: Claude, GPT, Gemini, Droid Core)
- Thinking mode controls (off/low/medium/high)
- Tabbed navigation (Sessions, Custom Task, Permissions, History)
- Real-time WebSocket updates
- Desktop-optimized layout

### ❌ Mobile Responsiveness Issues
1. **Layout Problems:**
   - Two-column grid layout (lg:grid-cols-3) doesn't collapse well
   - Activity sidebar takes valuable space on mobile
   - Fixed padding (p-4) too spacious on small screens
   - No viewport meta configuration

2. **Component Issues:**
   - Tab navigation doesn't scroll horizontally on narrow screens
   - Buttons don't stack vertically on mobile
   - Long text (session names, paths) doesn't truncate
   - Control state badges too wide
   - No responsive breakpoints in session cards

3. **Typography:**
   - Text sizes not adjusted for mobile
   - Headers too large on mobile
   - Hidden descriptions not conditional

---

## 2. Learnings from `feat/mobile-view`

The `feat/mobile-view` branch implemented a ChatGPT-style layout with:
- Sidebar navigation with sessions list
- Full-screen chat view
- Mobile hamburger menu
- Collapsible sidebar with overlay

**Key Mobile Improvements to Extract:**
1. ✅ Viewport configuration in `layout.tsx`
2. ✅ Responsive padding patterns (p-2 sm:p-4)
3. ✅ Horizontal scrolling tabs
4. ✅ Text truncation with ellipsis
5. ✅ Stacked button layouts
6. ✅ Flex-wrap for responsive elements
7. ✅ Conditional text visibility (hidden sm:inline)

**What NOT to take:**
- ❌ Sidebar navigation (changes UX significantly)
- ❌ ChatView component (different from current card-based approach)
- ❌ Full layout restructure

---

## 3. Implementation Steps

### **Phase 1: Layout Foundation (High Priority)**

#### Step 1: Add Viewport Configuration
**File:** `telegram-bridge/web/src/app/layout.tsx`

**Changes:**
```typescript
// Add Viewport import
import type { Metadata, Viewport } from 'next'

// Add viewport export
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}
```

**Why:** Ensures proper scaling on mobile devices, prevents zoom issues.

---

#### Step 2: Update Main Page Layout
**File:** `telegram-bridge/web/src/app/page.tsx`

**Changes:**
1. Update root container padding:
   ```typescript
   // Before: p-4
   // After:  p-2 sm:p-4
   className="min-h-screen bg-gray-900 text-white p-2 sm:p-4"
   ```

2. Update header responsiveness:
   ```typescript
   // Before: mb-6 flex items-center
   // After:  mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center
   className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-6xl mx-auto gap-2"
   ```

3. Update title sizing:
   ```typescript
   // Before: text-2xl
   // After:  text-xl sm:text-2xl
   className="text-xl sm:text-2xl font-bold"
   ```

4. Hide subtitle on mobile:
   ```typescript
   // Before: text-gray-400
   // After:  text-sm sm:text-base text-gray-400 hidden sm:block
   className="text-sm sm:text-base text-gray-400 hidden sm:block"
   ```

5. Update tab navigation spacing:
   ```typescript
   // Before: mb-6
   // After:  mb-4 sm:mb-6
   className="max-w-6xl mx-auto mb-4 sm:mb-6"
   ```

6. Make tabs scrollable:
   ```typescript
   // Before: flex gap-2
   // After:  flex gap-1 sm:gap-2 border-b border-gray-700 pb-2 overflow-x-auto
   className="flex gap-1 sm:gap-2 border-b border-gray-700 pb-2 overflow-x-auto"
   ```

7. Update tab button sizing:
   ```typescript
   // Before: px-4 py-2 text-sm
   // After:  px-3 sm:px-4 py-2 rounded-t-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap
   className={`px-3 sm:px-4 py-2 rounded-t-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${...}`}
   ```

8. Remove desktop grid layout and activity sidebar:
   ```typescript
   // Before:
   <div className="grid gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
     <div className="lg:col-span-2 space-y-6">
       {/* content */}
     </div>
     <div>
       <ActivityFeed />
     </div>
   </div>

   // After:
   <div className="max-w-6xl mx-auto">
     <div className="space-y-4 sm:space-y-6">
       {/* content */}
     </div>
   </div>
   ```

**Why:** 
- Single-column layout is cleaner on mobile
- Activity sidebar is secondary info, not critical
- Responsive padding saves screen space
- Scrollable tabs prevent overflow

---

### **Phase 2: Session Component Improvements (High Priority)**

#### Step 3: Update Session Card Responsiveness
**File:** `telegram-bridge/web/src/components/sessions/session-card.tsx`

**Impact:** Primary component - used in Sessions tab, contains chat history, model selector, task execution

**Changes:**

1. Update card header layout:
   ```typescript
   // Before: flex items-center justify-between
   // After:  flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0
   className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2"
   ```

2. Add width constraints to title:
   ```typescript
   // Before: flex items-center gap-2
   // After:  flex items-center gap-2 min-w-0 w-full sm:w-auto
   className="flex items-center gap-2 min-w-0 w-full sm:w-auto"
   ```

3. Make badges wrap on mobile:
   ```typescript
   // Before: flex items-center gap-2
   // After:  flex items-center gap-2 flex-wrap
   className="flex items-center gap-2 flex-wrap"
   ```

4. Shorten badge text on mobile:
   ```typescript
   // Before: {controlConfig.label}
   // After:
   <span className="hidden sm:inline">{controlConfig.label}</span>
   <span className="sm:hidden">{controlConfig.label.split(' ')[0]}</span>
   ```

5. Update metadata layout:
   ```typescript
   // Before: flex items-center gap-x-4 gap-y-1 text-xs
   // After:  flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-x-4 sm:gap-y-1 text-xs text-muted-foreground
   className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-x-4 sm:gap-y-1 text-xs text-muted-foreground"
   ```

6. Add truncation to project path:
   ```typescript
   <span className="flex items-center gap-1 truncate">
     <Folder className="h-3 w-3 shrink-0" />
     <span className="truncate">{session.project_dir}</span>
   </span>
   ```

7. Add shrink-0 to icons:
   ```typescript
   // All icons should have shrink-0 to prevent squishing
   <Clock className="h-3 w-3 shrink-0" />
   ```

8. Stack control buttons on mobile:
   ```typescript
   // Before: flex gap-2
   // After:  flex flex-col sm:flex-row gap-2
   className="flex flex-col sm:flex-row gap-2"
   ```

9. Update chat bubble max width:
   ```typescript
   // Before: max-w-[85%]
   // After:  max-w-[90%] sm:max-w-[85%]
   className={cn(
     'max-w-[90%] sm:max-w-[85%] rounded-lg px-3 py-2',
     // ... rest
   )}
   ```

**Why:**
- Flex-wrap prevents badge overflow
- Truncation keeps long paths readable
- Stacked buttons are easier to tap on mobile
- Conditional text saves horizontal space

---

### **Phase 3: Additional Component Updates (Medium Priority)**

#### Step 4: Update Task Form Responsiveness
**File:** `telegram-bridge/web/src/components/sessions/task-form.tsx`

**Impact:** Used in "Custom Task" tab for standalone task execution

**Changes:**

1. Update form spacing:
   ```typescript
   // Before: space-y-4
   // After:  space-y-3
   <form className="space-y-3" onSubmit={handleSubmit}>
   ```

2. Make button text responsive:
   ```typescript
   // Shorten button text on mobile
   {loading ? (
     <>
       <Loader2 className="h-4 w-4 mr-2 animate-spin" />
       <span className="hidden sm:inline">Executing...</span>
       <span className="sm:hidden">Running...</span>
     </>
   ) : (
     <>
       <Play className="h-4 w-4 mr-2" />
       <span className="hidden sm:inline">Execute Task</span>
       <span className="sm:hidden">Execute</span>
     </>
   )}
   ```

3. Update result display:
   ```typescript
   // Add responsive height
   // Before: max-h-60
   // After:  max-h-40 sm:max-h-60
   className="text-sm whitespace-pre-wrap overflow-auto max-h-40 sm:max-h-60"
   ```

**Why:** Task form should be compact on mobile with shorter labels and limited result height.

---

#### Step 5: Update Permission Card Responsiveness
**File:** `telegram-bridge/web/src/components/sessions/permission-card.tsx`

**Impact:** Used in permission requests display, shows pending permissions

**Changes:**

1. Make buttons stack on mobile:
   ```typescript
   // Before: flex gap-2
   // After:  flex flex-col sm:flex-row gap-2
   <div className="flex flex-col sm:flex-row gap-2 pt-2">
   ```

2. Make buttons full width on mobile:
   ```typescript
   // Before: flex-1
   // After:  w-full sm:flex-1
   className="w-full sm:flex-1"
   ```

3. Update JSON display max height:
   ```typescript
   // Before: max-h-32
   // After:  max-h-24 sm:max-h-32
   className="text-xs bg-muted p-2 rounded overflow-auto max-h-24 sm:max-h-32"
   ```

**Why:** Approve/Deny buttons should stack vertically on mobile for easier tapping.

---

#### Step 6: Update Permission History Responsiveness
**File:** `telegram-bridge/web/src/components/sessions/permission-history.tsx`

**Impact:** Shows list of all permission requests in Permissions tab

**Changes:**

1. Update card spacing:
   ```typescript
   // Before: space-y-3
   // After:  space-y-2 sm:space-y-3
   <div className="space-y-2 sm:space-y-3">
   ```

2. Update title size:
   ```typescript
   // Before: text-lg
   // After:  text-base sm:text-lg
   <CardTitle className="text-base sm:text-lg">Permission Requests</CardTitle>
   ```

**Why:** Tighter spacing on mobile prevents excessive scrolling.

---

#### Step 7: Update Task History Responsiveness
**File:** `telegram-bridge/web/src/components/sessions/task-history.tsx`

**Impact:** Shows list of executed tasks in History tab with expandable details

**Changes:**

1. Make filter buttons responsive:
   ```typescript
   // Update button group layout
   <div className="flex flex-col sm:flex-row gap-2">
     <Button
       size="sm"
       variant={showFailed ? 'default' : 'outline'}
       onClick={() => setShowFailed(!showFailed)}
       className="w-full sm:w-auto"
     >
       <span className="hidden sm:inline">{showFailed ? 'Show All Tasks' : 'Show Failed Only'}</span>
       <span className="sm:hidden">{showFailed ? 'All' : 'Failed'}</span>
     </Button>
     <Button size="sm" variant="ghost" onClick={fetchTasks} className="w-full sm:w-auto">
       <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
       <span className="ml-2 sm:hidden">Refresh</span>
     </Button>
   </div>
   ```

2. Update task item layout:
   ```typescript
   // Make metadata wrap on mobile
   // Before: flex items-center gap-4
   // After:  flex flex-wrap items-center gap-2 sm:gap-4
   <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground">
   ```

3. Update expanded section max height:
   ```typescript
   // Before: max-h-40
   // After:  max-h-32 sm:max-h-40
   className="text-xs bg-muted p-2 rounded overflow-auto max-h-32 sm:max-h-40 whitespace-pre-wrap"
   ```

**Why:** Filter buttons should be touch-friendly, task details should fit mobile screens.

---

#### Step 8: Update Session Timeline Responsiveness
**File:** `telegram-bridge/web/src/components/sessions/session-timeline.tsx`

**Impact:** Visual timeline of session events (if displayed in session details)

**Changes:**

1. Update timeline spacing:
   ```typescript
   // Before: space-y-3
   // After:  space-y-2 sm:space-y-3
   <div className="space-y-2 sm:space-y-3">
   ```

2. Update timeline items:
   ```typescript
   // Make badges and metadata wrap
   <div className="flex flex-wrap items-center gap-1 sm:gap-2">
     <Badge variant="outline" className="text-[10px] sm:text-xs">
       {item.type}
     </Badge>
     <span className="text-[10px] sm:text-xs text-muted-foreground">
       {formatRelativeTime(item.created_at)}
     </span>
   </div>
   ```

**Why:** Timeline should be more compact on mobile with smaller text and tighter spacing.

---

#### Step 9: Update Connection Status
**File:** `telegram-bridge/web/src/components/connection-status.tsx`

**Impact:** WebSocket status indicator in header

**Changes:**

1. Hide text on very small screens:
   ```typescript
   <div className="flex items-center gap-2 text-sm">
     <span
       className={cn('h-2 w-2 rounded-full', connected ? 'bg-green-500' : 'bg-red-500')}
     />
     <span className="text-muted-foreground hidden sm:inline">
       {connected ? 'Connected' : 'Disconnected'}
     </span>
   </div>
   ```

**Why:** On mobile, just the dot is sufficient to show connection status.

---

### **Phase 4: Typography & Spacing (Medium Priority)**

#### Step 10: Update Section Headers
**Files:** Multiple components with section headers

**Changes:**
```typescript
// Before: text-lg
// After:  text-base sm:text-lg
className="mb-4 text-base sm:text-lg font-semibold"
```

**Why:** Proportionally sized headers look better on small screens.

---

#### Step 11: Adjust Spacing Throughout
**Pattern to apply:**
```typescript
// Margins: mb-6 → mb-4 sm:mb-6
// Padding: p-4 → p-3 sm:p-4
// Gaps: gap-6 → gap-4 sm:gap-6
// Spacing: space-y-6 → space-y-4 sm:space-y-6
```

**Why:** Tighter spacing on mobile prevents excessive scrolling.

---

### **Phase 5: Testing & Verification (High Priority)**

#### Step 12: Manual Testing Checklist

**Desktop (>1024px):**
- [ ] All features visible and functional
- [ ] No layout shifts or overflows
- [ ] Tab navigation works
- [ ] Session cards display properly
- [ ] Chat history readable
- [ ] Buttons properly sized

**Tablet (768px - 1023px):**
- [ ] Layout adapts to single column
- [ ] Tabs scroll horizontally if needed
- [ ] Session cards remain readable
- [ ] Buttons accessible
- [ ] No text cutoff

**Mobile (320px - 767px):**
- [ ] All content visible without horizontal scroll
- [ ] Tabs scroll horizontally
- [ ] Buttons stack vertically
- [ ] Text truncates with ellipsis
- [ ] Chat bubbles sized appropriately
- [ ] Touch targets at least 44x44px
- [ ] No pinch-zoom issues
- [ ] Activity feed hidden (not needed)

**Specific User Flows to Test:**
1. **Session Control Flow:**
   - View session list
   - Select session → Take control
   - Send task → View response in chat
   - Change model and thinking mode
   - Release control

2. **Custom Task Flow:**
   - Switch to Custom Task tab
   - Enter project directory and prompt
   - Select model
   - Execute task → View results

3. **Permission Flow:**
   - Switch to Permissions tab
   - View pending permissions
   - Tap Approve/Deny buttons
   - Verify buttons are easy to tap on mobile

4. **History Flow:**
   - Switch to History tab
   - Toggle "Failed Only" filter
   - Expand task details
   - Verify scrolling works

5. **Visual Checks:**
   - Long session names truncate with ellipsis
   - Long project paths display correctly
   - Chat history scrolls smoothly
   - Badges wrap instead of overflow
   - Buttons stack vertically on mobile
   - Tab navigation scrolls horizontally

6. **Component-Specific:**
   - Session card chat bubbles sized correctly
   - Permission card buttons are tap-friendly
   - Task form inputs are usable
   - Timeline displays without horizontal scroll
   - Connection status visible in header

---

#### Step 13: Build Verification
```bash
cd telegram-bridge/web
npm run build
```

**Expected:** Clean build with no TypeScript errors or warnings.

---

## 4. Expected Outcomes

### Before (Current):
- Desktop-optimized with activity sidebar
- Fixed padding and spacing
- Text overflow on mobile
- Buttons side-by-side
- No viewport config
- Three-column grid on large screens

### After (Mobile-Responsive):
- Single-column layout on all screens
- Responsive padding (less on mobile)
- Truncated text with ellipsis
- Stacked buttons on mobile
- Proper viewport scaling
- Activity sidebar removed (cleaner mobile UX)
- Scrollable tab navigation
- Touch-friendly tap targets

### Responsive Breakpoints:
- **Mobile:** 0-767px (sm breakpoint)
- **Desktop:** 768px+ (sm: prefix applies)

---

## 5. Implementation Order

### **Recommended Sequence:**

1. **Phase 1: Foundation (Steps 1-2) - Do First**
   - Step 1: Add viewport configuration to layout.tsx
   - Step 2: Update main page layout, tabs, remove activity sidebar
   - Quick build test to verify no TypeScript errors

2. **Phase 2: Core Session Control (Step 3) - Critical**
   - Step 3: Update session card (most used component)
   - Test session control flow end-to-end

3. **Phase 3: Supporting Components (Steps 4-9) - Important**
   - Step 4: Task form (Custom Task tab)
   - Step 5: Permission card (approve/deny buttons)
   - Step 6: Permission history (list view)
   - Step 7: Task history (with filters)
   - Step 8: Session timeline (visual timeline)
   - Step 9: Connection status (header indicator)
   - Test each tab after updating

4. **Phase 4: Polish (Steps 10-11) - Nice to Have**
   - Step 10: Typography adjustments
   - Step 11: Spacing refinements
   - Review all pages for consistency

5. **Phase 5: Final Testing (Steps 12-13)**
   - Step 12: Manual testing checklist
   - Step 13: Build verification
   - Test on actual mobile devices

### **Alternative Approach (Faster):**
If time is limited, implement in this order:
1. Steps 1-3 (Foundation + Session Card) → Test → Commit
2. Steps 4-7 (Forms + History) → Test → Commit
3. Steps 8-11 (Polish) → Test → Commit
4. Steps 12-13 (Final Testing)

---

## 6. Files to Modify

### Phase 1: Layout Foundation (Steps 1-2)
1. `telegram-bridge/web/src/app/layout.tsx` - Viewport config
2. `telegram-bridge/web/src/app/page.tsx` - Main layout, tabs, remove activity sidebar

### Phase 2: Session Components (Step 3)
3. `telegram-bridge/web/src/components/sessions/session-card.tsx` - Main session control responsiveness

### Phase 3: Additional Components (Steps 4-9)
4. `telegram-bridge/web/src/components/sessions/task-form.tsx` - Custom task form responsiveness
5. `telegram-bridge/web/src/components/sessions/permission-card.tsx` - Permission request card buttons
6. `telegram-bridge/web/src/components/sessions/permission-history.tsx` - Permission list layout
7. `telegram-bridge/web/src/components/sessions/task-history.tsx` - Task history filters and items
8. `telegram-bridge/web/src/components/sessions/session-timeline.tsx` - Timeline spacing
9. `telegram-bridge/web/src/components/connection-status.tsx` - Header status indicator

### Phase 4: Polish (Steps 10-11)
- All files: Typography and spacing adjustments

**Total Files:** 9 files across all phases
**Activity Feed:** Will be removed (not modified)

---

## 7. Success Criteria

✅ **Must Have:**
- No horizontal scrolling on mobile (320px width)
- All interactive elements have 44x44px tap targets
- Text truncates instead of overflowing
- Tabs scroll horizontally when needed
- Buttons stack vertically on mobile
- Clean TypeScript build

✅ **Nice to Have:**
- Smooth transitions between breakpoints
- Consistent spacing across screen sizes
- Optimized font sizes for readability
- No layout shifts during load

---

## 8. Rollback Plan

If issues arise:
```bash
# Discard changes and return to develop
git checkout develop
git branch -D feat/mobile-responsive-ui
```

Or:
```bash
# Keep branch but reset to before changes
git reset --hard HEAD~1
```

---

## 9. Next Steps After Completion

1. Merge to `develop` branch
2. Test on actual mobile devices (iOS Safari, Android Chrome)
3. Consider adding touch gestures (swipe to go back, pull to refresh)
4. Optimize images and assets for mobile
5. Add PWA support for installable mobile app
6. Performance testing on 3G/4G networks

---

---

## 10. Feature Coverage Verification

### ✅ All 9 Components Covered:

| Component | Plan Coverage | Steps |
|-----------|---------------|-------|
| Session Card | ✅ Fully covered | Step 3 (header, badges, buttons, chat, settings) |
| Task Form | ✅ Fully covered | Step 4 (spacing, button text, result display) |
| Permission Card | ✅ Fully covered | Step 5 (button stacking, full width, JSON display) |
| Permission History | ✅ Fully covered | Step 6 (spacing, title size) |
| Task History | ✅ Fully covered | Step 7 (filters, metadata, expandable details) |
| Session Timeline | ✅ Fully covered | Step 8 (spacing, badge sizes) |
| Activity Feed | ✅ Will be removed | Step 2 (removal from page.tsx) |
| Connection Status | ✅ Fully covered | Step 9 (hide text on mobile) |
| Session List | ✅ Covered via Session Card | Step 3 (renders session cards) |

### ✅ All Features Preserved:
- ✅ Remote control workflow (Take Control/Release)
- ✅ Chat history persistence to SQLite
- ✅ Settings persistence (model + reasoning effort)
- ✅ Permission request handling (approve/deny)
- ✅ Model selector (8 models)
- ✅ Thinking mode controls (off/low/medium/high)
- ✅ Tabbed navigation (Sessions, Custom Task, Permissions, History)
- ✅ Real-time WebSocket updates
- ✅ Task execution with expandable details
- ✅ Timeline visualization
- ✅ Connection status indicator

### ✅ All User Flows Covered:
1. ✅ Session control flow → Step 3 (session card)
2. ✅ Custom task execution → Step 4 (task form)
3. ✅ Permission approval → Steps 5-6 (permission card & history)
4. ✅ History viewing → Step 7 (task history)
5. ✅ Tab navigation → Step 2 (page layout)
6. ✅ Model/settings changes → Step 3 (session card settings)

### 📱 Mobile Improvements Applied:
- ✅ Viewport configuration (Step 1)
- ✅ Single-column layout (Step 2)
- ✅ Responsive padding (All steps)
- ✅ Scrollable tabs (Step 2)
- ✅ Truncated text (Steps 3, 7, 8)
- ✅ Stacked buttons (Steps 3, 5, 7)
- ✅ Flex-wrap badges (Step 3)
- ✅ Touch-friendly targets (All steps)
- ✅ Conditional text (Steps 4, 7, 9)
- ✅ Responsive typography (Steps 10-11)

---

**Ready to proceed?** Review this plan and let me know if you want to:
- Add more changes
- Skip certain steps
- Modify the approach
- Start implementation

All features from the develop branch are covered in this plan.
