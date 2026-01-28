---
name: "product-planner"
description: "Transforms product ideas into detailed PRDs and iterative roadmaps. Invoke when user needs product planning, feature breakdown, or MVP design."
---

# Product Planner

This skill transforms raw product ideas into comprehensive Product Requirement Documents (PRDs) with clear iteration plans and feature prioritization.

## When to Invoke

**Use this skill when:**
- User wants to create a new product or feature
- User needs a PRD document
- User asks for MVP design or feature breakdown
- User wants version iteration planning
- User needs product roadmap creation
- Requirements need to be translated into dev-ready specs

**Do NOT use when:**
- User only needs code implementation
- User is asking about existing code functionality
- Simple questions that don't require product planning

## Input Requirements

When invoking, provide:
1. Product concept/vision (what user wants to build)
2. Target users and use cases
3. Any specific requirements or constraints
4. Desired output format (PRD only, or full roadmap)

## Output Deliverables

The skill will generate:

### 1. Product Vision & Overview
- Product vision statement
- Target market and users
- Core value proposition
- Success metrics

### 2. Feature Breakdown (MoSCoW Method)
- Must have (P0)
- Should have (P1)
- Could have (P2)
- Won't have (Wont)

### 3. PRD Sections
- Background & problem statement
- User stories
- Functional requirements
- Non-functional requirements
- UI/UX guidelines
- Edge cases & error handling
- Metrics & success criteria

### 4. Iteration Roadmap
- MVP version (core features only)
- V1.0 (essential features)
- V1.1+ (enhancements)
- Future considerations

### 5. Technical Considerations (if applicable)
- Integration requirements
- Data models
- API specifications
- Security considerations

## Output Location

All outputs should be saved to `doc/` directory:
- Main PRD: `doc/product-name-prd.md`
- Iteration plan: `doc/product-name-roadmap.md`
- UI/UX specs: `doc/product-name-ui-ux.md` (if requested)

## Example Usage

```
User: "我想做一个帮助自由职业者管理项目和收入的工具"

Invoke product-planner skill with:
- Product concept: Freelancer project & income management tool
- Target users: Freelancers
- Requirements: Project tracking, income analytics, invoicing
- Output: Full PRD + MVP design + V1 roadmap
```

## Quality Standards

- PRDs should be dev-ready (clear enough for implementation)
- Features should be traceable to user stories
- Iteration plans should be realistic and prioritized
- Consider technical feasibility and dependencies
- Include acceptance criteria for each feature
