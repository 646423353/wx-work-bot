---
name: "ui-prototype-designer"
description: "Transforms PRD documents into HTML-based UI/UX prototypes using Tailwind CSS. Invoke when user needs UI design, prototype creation, or UX flow design."
---

# UI/UX Prototype Designer

This skill transforms Product Requirement Documents (PRDs) into beautiful, functional HTML-based UI/UX prototypes using Tailwind CSS, ensuring aesthetic excellence and adherence to product specifications.

## When to Invoke

**Use this skill when:**
- User has a PRD and needs UI/UX design
- User wants to create clickable prototypes
- User needs design mockups for stakeholder review
- User wants to visualize product flows
- User needs responsive design implementations
- User requests UI design based on specifications

**Do NOT use when:**
- User only needs code implementation
- User is asking about existing UI components
- Simple style changes without PRD context

## Input Requirements

When invoking, provide:
1. PRD document or product specifications
2. Target pages/screens needed
3. Design preferences (if any)
4. Responsive requirements
5. Color scheme/theme preferences

## Output Deliverables

The skill will generate:

### 1. Design System
- Color palette (brand colors, neutrals, semantic colors)
- Typography system (headings, body, captions)
- Spacing scale and layout grid
- Component library (buttons, inputs, cards, etc.)

### 2. Page Designs
- Dashboard/Home
- Key user flows and screens
- Interactive components
- Modal/dialog designs
- Form designs
- Data visualization layouts

### 3. UX Documentation
- User flow diagrams
- Interaction patterns
- State definitions (loading, empty, error, success)
- Accessibility considerations

### 4. Technical Implementation
- HTML structure with Tailwind CSS
- Responsive breakpoints
- Component modularity for easy integration
- Interactive states and hover effects

## Output Location

All outputs should be saved to:
- Design files: `ui-designs/` directory
- HTML prototypes: `ui-designs/prototypes/`
- Style guide: `ui-designs/style-guide.md`

## Design Principles

1. **Aesthetic Excellence**
   - Clean, modern design language
   - Consistent visual hierarchy
   - Thoughtful whitespace and layout
   - Professional color schemes

2. **User-Centric**
   - Clear navigation and information architecture
   - Intuitive interactions
   - Accessibility-first approach
   - Mobile-responsive designs

3. **PRD Adherence**
   - Every design element traces to a requirement
   - User flows match user stories
   - Functional requirements translated to UI components
   - Edge cases considered in error states

## Technology Stack

- HTML5 for structure
- Tailwind CSS for styling
- Vanilla JavaScript for interactivity
- No external framework dependencies
- Font Awesome or similar for icons (CDN)

## Quality Standards

- Pixel-perfect implementation
- Cross-browser compatibility
- Responsive on all devices
- Accessible (WCAG 2.1 AA)
- Performance optimized
- Clean, maintainable code

## Example Usage

```
User: "请根据doc目录下的prd文件，为新的用户注册流程设计一个完整的UI原型"

Invoke ui-prototype-designer skill with:
- PRD location: doc/user-registration-prd.md
- Required screens: Registration form, Email verification, Success page
- Brand colors: Blue primary, white background
- Responsive: Yes, mobile-first approach
```

## Iteration Workflow

1. Receive PRD and requirements
2. Analyze user flows and key screens
3. Create wireframe concepts
4. Develop high-fidelity designs
5. Implement HTML/CSS prototypes
6. Add interactivity
7. Review and refine
8. Deliver final prototype
