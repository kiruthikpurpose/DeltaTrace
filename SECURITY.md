# Security Policy

## Scope

DeltaTrace Live runs entirely in the browser. It has no backend, makes no network requests at runtime and stores only preferences and records in `localStorage`. It never issues control commands.

## Supported versions

Only the latest commit on `main` is supported.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting for this repository (Security tab, "Report a vulnerability"). Include steps to reproduce and the affected page or component. You can expect an acknowledgement within a few days.

## Deployment note

If you adapt this code to connect to a real control system, treat that integration as safety-critical: keep the gateway read-only, require operator approval for every parameter write, and follow your site's management-of-change process.
