# AEO Audit Client

A professional React.js client application for the AEO (Answer Engine Optimization) Audit Tool.

## Features

- **Modern React Architecture**: Uses React 18 with hooks and context API
- **Application Context**: Global state management for audit operations
- **Professional UI**: Built with Tailwind CSS for a clean, modern interface
- **Real-time Updates**: Polls for audit results and updates in real-time
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Comprehensive Results**: Beautiful visualization of audit scores and recommendations

## Getting Started

### Prerequisites

- Node.js 14+ and npm
- AEO Audit API server running on port 8000

### Installation

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
```

## Project Structure

```
client/
├── public/
│   └── index.html
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Header.js
│   │   ├── LoadingSpinner.js
│   │   ├── ScoreOverview.js
│   │   ├── CategoryBreakdown.js
│   │   ├── Recommendations.js
│   │   └── CriticalIssues.js
│   ├── contexts/           # React Context
│   │   └── AuditContext.js
│   ├── pages/              # Page components
│   │   ├── Home.js
│   │   └── AuditResults.js
│   ├── services/           # API services
│   │   └── api.js
│   ├── App.js              # Main app component
│   ├── index.js            # Entry point
│   └── index.css           # Global styles
├── package.json
├── tailwind.config.js
└── README.md
```

## Key Features

### 1. Application Context
- Global state management for audit operations
- Automatic polling for audit results
- Error handling and loading states

### 2. Professional UI Components
- **Score Overview**: Visual score display with charts
- **Category Breakdown**: Detailed analysis by category
- **Recommendations**: Actionable improvement suggestions
- **Critical Issues**: Priority-based issue identification

### 3. Real-time Updates
- Automatic polling every 2 seconds
- Live status updates during audit processing
- Seamless navigation to results

### 4. Responsive Design
- Mobile-first approach
- Tailwind CSS for consistent styling
- Professional color scheme and typography

## API Integration

The client integrates with the AEO Audit API through:

- **Start Audit**: `POST /aeo-audit-tool/api/audit`
- **Get Results**: `GET /aeo-audit-tool/api/audit/{taskId}`

All API calls are handled through the `AuditContext` for consistent state management.

## Styling

The application uses Tailwind CSS with custom utility classes:

- `.btn-primary`: Primary button styling
- `.card`: Card component styling
- `.score-badge`: Score level badges
- `.score-excellent/.score-good/.score-fair/.score-poor/.score-critical`: Score level colors

## Environment Variables

Create a `.env` file in the client root:

```
REACT_APP_API_URL=http://localhost:8000/aeo-audit-tool/api
```

## Deployment

The application is ready for deployment to any static hosting service:

1. Run `npm run build` to create the production build
2. Deploy the `build` folder to your hosting service
3. Configure the API URL for production

## Technologies Used

- **React 18**: Modern React with hooks
- **React Router**: Client-side routing
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client for API calls
- **Recharts**: Data visualization
- **Heroicons**: Icon library

## Contributing

1. Follow the existing code style
2. Use Tailwind CSS classes for styling
3. Maintain the component structure
4. Test thoroughly before submitting changes
