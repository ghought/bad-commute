# Adding a vehicle

The game ships one vehicle and no vehicle chooser. Everything else in the game refers to a vehicle only by id.

1. **Define it.** Create a `VehicleDefinition` with its id, input actions, physics, rider attachment, visual key, damage rules, camera envelope and clearance. See `src/vehicles/motorbike/definition.ts`.
2. **Implement it.** Write a class that meets `VehicleController` in `src/vehicles/types.ts`: spawn, fixed update, contact changes, telemetry, ghost poses, sever, kill, settle, dispose.
3. **Register it** in `src/vehicles/index.ts`.
4. **Draw it.** Add art alongside `src/render/motorbikeArt.ts` and branch on `def.visual` in the renderer.
5. **Allow it per course** with `allowedVehicles`. Do not assume every course works for every vehicle: `clearance` and mechanism sizes were built around the bike.

Damage events use body regions and part names. Finish checks use the chassis telemetry, with no wheel indices. Records are already keyed by vehicle id, so a second vehicle gets separate times and ghosts automatically.

The route verifier takes a vehicle id too: expect to write vehicle-specific routes.
