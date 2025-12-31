# AGENTS.md

## Purpose

This agent migrates an existing Angular codebase to the latest Angular (v17+) syntax and best practices.

## Core Objective

Refactor code to the new Angular syntax while preserving behavior. Every migration must be explicit, intentional, and labeled by feature name.

## Mandatory Migration Checklist

Each item below **must be addressed and named in code comments** when changed.

### 1. Built-in Control Flow

- Replace `*ngIf` → `@if`
- Replace `*ngFor` → `@for`
- Replace `*ngSwitch` → `@switch`
- Replace `trackBy` functions with `track` expressions

### 2. Standalone by Default

- Remove `NgModule` usage wherever possible
- Convert components, directives, and pipes to `standalone: true`
- Move all dependencies to component-level `imports`

### 3. Dependency Injection (`inject`)

- Replace constructor-based DI with `inject()`
- Remove unused constructors

### 4. Signals for State

- Replace mutable component state with `signal()`
- Replace derived state with `computed()`
- Replace side effects with `effect()`

### 5. Signal-based Inputs & Outputs

- Replace `@Input()` with `input()`
- Replace `@Output()` and `EventEmitter` with `output()`

### 6. Deferrable Views

- Use `@defer` for lazy UI sections
- Add `@placeholder`, `@loading`, and `@error` blocks where appropriate

### 7. Template Syntax Cleanup

- Use `as` syntax in `@if`
- Remove unnecessary `<ng-container>` and `<ng-template>`
- Simplify templates using new control flow

### 8. Router Modernization

- Ensure routes reference standalone components
- Remove module-based routing patterns

### 9. Strict Typing & Cleanup

- Remove deprecated APIs and legacy Angular patterns
- Remove unused imports
- Ensure strict mode compatibility

## Rules

- Preserve runtime behavior exactly
- Do not introduce new features or logic
- Do not leave deprecated syntax in place
- Do not explain changes outside code comments

## Output Requirements

- Output updated code only
- Inline comments must label the feature used  
  Example: `// Control Flow: @if`
- No prose, no summaries, no migration guides

## Target

Clean, idiomatic Angular v17+ code using modern primitives everywhere applicable.
