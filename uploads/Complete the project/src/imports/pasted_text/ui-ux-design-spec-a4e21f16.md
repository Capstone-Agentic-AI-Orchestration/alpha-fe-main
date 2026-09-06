Act as a Senior UI/UX Engineer and Design System Architect. Replicate the visual layout, UI patterns, and spatial hierarchy from the provided reference images and integrate them directly into our existing Figma design file.

CRITICAL REQUIREMENT: Do not destroy, overwrite, or alter the existing design system tokens (colors, typography scales, auto-layout padding, border-radii), variable modes, or persona-based access logic. Align every visual element with our current system architecture.

---

### GLOBAL LAYOUT & STYLING SPECIFICATIONS
- Structural Canvas: Light theme dashboard layout with a fixed left-side navigation sidebar, top topbar header with quick action icons (Search, Settings, Notifications, AI Assistant badge), and dynamic main workspace container.
- Design Aesthetics: Crisp, modern SaaS aesthetic with subtle light-grey backgrounds (#F8F9FC or equivalent token), pure white card surfaces with 12px–16px border-radius, hairline borders (#E5E7EB), and primary purple/indigo accent buttons (#534BF3 or current system primary variable).
- Component Rules: Utilize Auto Layout (vertical/horizontal flex) for all frames, responsiveness, and consistent 8px/16px/24px padding grids.

---

### PAGE MAPPING & LAYOUT BLUEPRINTS

1. TARGET PAGE: "Overview" (Reference: Image "Dashboard")
- Top Section: "Profile Status" wide banner with completion percentage (75%) radial/donut graph, next steps checklist, and callout banner.
- Overview Metrics Row: 4 equal-width key performance cards:
  * Card 1: Daily Meetings (Metric + Line graph chart overlay).
  * Card 2: Booked Meetings (Metric + Bar chart overlay).
  * Card 3: Monthly Income (Metric + Area chart overlay).
  * Card 4: Used Storage (Metric + status indicator list).
- Main Body Split:
  * Left Column (Main Content): 
    - "Upcoming Meetings" horizontal scroll/carousel featuring status tags ("LIVE", "START IN 5 MIN"), workspace categories, duration timers, stacked attendee avatar groups (+45 badge), and primary CTA actions.
    - "Rooms" section beneath featuring room cards with active participant tags and "Join Room" / "+ New Room" buttons.
  * Right Column (Utility Sidebar):
    - Compact mini-calendar widget ("July 2025" view with day grid and hourly schedule preview).
    - Vertical stack of active member avatar status indicators on the far right edge.

2. TARGET PAGE: "Agent Chat" (Reference: Image "Chat")
- Left Sub-Sidebar (Conversations List, ~320px width):
  * Header controls: Grouping dropdown ("Grouped by"), search icon, filter, and compose icon.
  * Conversation Categories: Standardized collapsible lists for "Unread", "Favorite Messages", and "Direct Messages".
  * Message List Items: Circular avatar, user name, timestamp, active status, text snippet preview, and red numeric unread badge counter.
- Right Panel (Active Workspace / Stage):
  * Default empty state view with a centered plane icon, prompt: "Select a chat to start messaging", or full conversation thread stage ready for rendering active threads.

3. TARGET PAGE: "Calendar" (Newly Added Page; Reference: Image "Calendar")
- Layout: Dual-column workspace view.
- Left Column (Schedule View):
  * Header: Month/Year navigation picker, "Today" button, and "Manage Widgets" CTA.
  * Main View: Full day hourly timeline grid (9 AM to 4 PM) with red horizontal current-time indicator line, color-coded block cards for scheduled events (e.g., "Design Process" 11:00 - 11:30 AM), and slot creation affordances.
- Right Column (AI Assistant / Context Panel):
  * Integrates an embedded AI assistant chat stage ("Powered by ChatGPT") with message history bubbles, attachment icon toolbar (file, image, voice note), and bottom fixed prompt input bar.

4. TARGET PAGE: "Workspace Settings" (Reference: Image "Settings")
- Left Navigation Column (Sub-settings menu):
  * Vertical tab list: "Edit Profile" (active state), "Account Security", "Notifications", "Integrations", "Sessions", "Appearance".
- Main Content Area (Edit Profile Form):
  * Title header: "Edit Profile".
  * Form Fields (Grid): Display Name, Username (with helper subtext "Username can only be changed once per 14 days"), Email input, Phone input with country selector prefix (+1), and Address multi-line text area.
  * Primary action: Bottom-aligned "Save Changes" button.
- Right Panel (Profile Photo Management):
  * Elevated card containing circular avatar display, dimension helper text ("At least 800x800 px recommended..."), primary button "Upload New Image", and secondary ghost button "Remove".

5. TARGET PAGE: "Live Build Room" (Reference: Image "Rooms")
- Top Bar Controls: Header title "Live Build Room", left action button "+ New Room", and right-aligned header search, filter, and grid/calendar view toggles.
- Agent Card Containers (Responsive Grid Layout):
  * Individual Agent Container Component: Replicate card structures containing:
    - Card Surface: White background frame, subtle border radius (12px), hairline stroke border.
    - Top Metadata: Room Title ("Personal Room") and sub-label/handle ("/NAME").
    - Middle Info Row: Duration counter (clock icon + "23':02\"") and stacked circular participant avatar group with overflow pill (+45).
    - Bottom Action Bar: Full-width primary action button ("Join Now" for active states; disabled/muted variant for inactive states).
- Right Utility Sidebar: Vertical bar with circular stacked team member avatars and live status indicators.

---

### PERSONA LOGIC & SYSTEM INTEGRATION SAFEGUARDS
- Dynamic Component States: Ensure interactive states (default, hover, active, disabled) use the host system's variant properties.
- Role-Based Visibility Controls: Bind permissions to components (e.g., "Upgrade to Pro" banner visible to Admin/Standard roles only; "+ New Room" button restricted according to system persona logic).
- Non-Destructive Update: Map existing color, text, and component styles from the local Figma library to all newly created elements. Do not introduce detachments or unlinked raw hex codes.