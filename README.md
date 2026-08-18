# Alpha Frontend

## Technology stack and setup

- React 18
- TypeScript
- Vite 6
- Tailwind CSS 3
- Lucide icons

Node.js 20 LTS or newer and npm are recommended.

```bash
node --version
npm --version
npm install
```

## Development and build commands

Start the development server:

```bash
npm run dev
```

The application is available at `http://localhost:3000` by default.

Type-check and create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## UI direction

The MVP keeps the Multica-style workspace model while aiming for a calmer, client-ready experience:

- Use fewer nested containers and decorative pills.
- Prefer dense, scannable lists for repetitive information.
- Use clear sans-serif typography and reserve monospace for technical values.
- Use subtle dark surfaces and simple status indicators.
- Use focused pop-up dialogs for detailed workflows such as CI/CD run inspection.
- Guide the prototype through project, issue, agent-plan, review, and CI/CD validation steps.

See [DESIGN.md](./DESIGN.md) for the complete interface guidelines and UI change log.

## Vite troubleshooting

### `vite` is not recognized

Install the declared dependencies before starting the application:

```bash
npm install
npm run dev
```

If the issue remains, confirm that Node.js and npm are available in the same terminal:

```bash
node --version
npm --version
```

Reopen the terminal after correcting or updating the Node.js installation.

### Port 3000 is already in use

Stop the process using port 3000, or temporarily use another port:

```bash
npm run dev -- --port 5173
```
