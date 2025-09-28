# GitHub Copilot Instructions for ioBroker.openknx

## Project Overview

This is an ioBroker adapter for KNX/openKNX building automation systems. The adapter provides integration between ioBroker smart home platform and KNX IP gateways, enabling control and monitoring of KNX devices through group addresses.

## Architecture & Structure

### Core Components
- `main.js` - Main adapter class extending `@iobroker/adapter-core`
- `lib/knx/` - Modified KNX.js library for KNX protocol communication
- `lib/projectImport.js` - ETS project import functionality
- `lib/tools.js` - Utility functions for KNX data types and conversions
- `lib/openknx.js` - Discovery and auto-detection of KNX IP gateways
- `lib/loadMeasurement.js` - Device measurement and data processing

### Admin Interface
- `admin/` - React-based configuration UI with Material-UI components
- Handles KNX gateway configuration, ETS project import, and alias settings

## Development Guidelines

### Code Style & Standards
- Use ESLint configuration defined in `eslint.config.mjs`
- Follow Prettier formatting from `prettier.config.mjs`
- Use JSDoc comments for function documentation
- Maintain GPL-3.0-only license headers in new files

### ioBroker Adapter Patterns
- Extend `utils.Adapter` from `@iobroker/adapter-core`
- Use `this.log.info/warn/error/debug()` for logging
- Handle `ready`, `stateChange`, `message`, and `unload` events
- Use `this.setState()` and `this.getState()` for object management
- Follow ioBroker object naming conventions: `adapter.instance.device.channel.state`

### KNX-Specific Context
- **Group Addresses**: Use format `main/middle/sub` (e.g., "1/2/3")
- **DPT (Datapoint Types)**: Handle KNX data types like DPT-1 (boolean), DPT-5 (percentage), DPT-9 (temperature)
- **KNX Connection**: Manage connection lifecycle with proper error handling
- **ETS Import**: Support ETS XML file parsing for automatic object creation
- **Aliases**: Support automatic alias creation for status/control pairs

### Key Patterns & Conventions

#### Logging
```javascript
this.log.info(`Connected to KNX gateway at ${gwip}:${gwipport}`);
this.log.warn(`No DPT specified for GA ${ga}`);
this.log.error(`Connection failed: ${error.message}`);
```

#### State Management
```javascript
await this.setStateAsync(id, {
    val: value,
    ack: true,
    ts: Date.now()
});
```

#### KNX Communication
```javascript
this.knxConnection.write(ga, value, dpt);
this.knxConnection.read(ga);
```

## Testing Requirements

### Test Structure
- `test/unit.js` - Unit tests using `@iobroker/testing`
- `test/package.js` - Package validation tests
- `test/integration.js` - Integration tests with KNX simulation
- Use Mocha test framework with `should` assertions

### Test Patterns
```javascript
const { tests } = require("@iobroker/testing");
tests.unit(path.join(__dirname, ".."));
```

## Build & Release Process

### Scripts
- `npm run build` - Build admin interface
- `npm run test` - Run all tests (JS + package validation)
- `npm run lint` - Run ESLint
- `npm run release` - Create release using `@alcalzone/release-script`

### Dependencies
- Node.js >= 20 required
- Core dependency: `@iobroker/adapter-core`
- KNX library: Custom fork of `knx` package
- Admin UI: React with Material-UI components

## Security & Best Practices

### Input Validation
- Validate group addresses format (0-31/0-7/0-255)
- Sanitize ETS XML imports
- Validate DPT assignments and data ranges

### Error Handling
- Graceful KNX connection failures
- Timeout handling for KNX operations
- Proper cleanup in `onUnload` handler

### Performance
- Implement rate limiting for KNX bus (minimumDelay setting)
- Efficient group address lookups using DoubleKeyedMap
- Batch operations for multiple value updates

## Common Tasks & Patterns

### Adding New DPT Support
1. Add DPT definition in `lib/tools.js`
2. Implement conversion functions
3. Update admin UI for DPT selection
4. Add test cases for new data type

### ETS Import Enhancement
1. Extend XML parsing in `lib/projectImport.js`
2. Handle new ETS schema elements
3. Update object creation logic
4. Add validation for new import features

### Admin UI Changes
1. Update React components in `admin/src/`
2. Follow Material-UI design patterns
3. Handle i18n translations in `admin/i18n/`
4. Test across different browsers

## Documentation Standards

- Update `README.md` for user-facing changes
- Update `docs/en/README.md` for detailed documentation
- Use changelog format in `io-package.json` news section
- Include migration hints for breaking changes

## Common Pitfalls to Avoid

- Don't block the event loop with synchronous KNX operations
- Always validate group addresses before KNX operations
- Handle KNX gateway disconnections gracefully
- Respect KNX bus timing constraints (minimumDelay)
- Use proper DPT encoding/decoding for data types
- Avoid duplicate group address assignments
- Clean up timers and connections in `onUnload`

## Context for AI Assistance

When working on this project, consider:
- KNX is a fieldbus system for building automation
- ETS is the Engineering Tool Software for KNX configuration
- Group addresses are the primary addressing mechanism in KNX
- DPT (Datapoint Types) define data format and semantics
- The adapter bridges KNX protocol to ioBroker's object model
- Performance is critical as KNX is a low-bandwidth bus system