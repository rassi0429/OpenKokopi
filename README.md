# MirageX App

## Overview
MirageX is a web application that allows users to deploy applications to a Kubernetes cluster. It provides a simple interface for managing deployments, viewing logs, and deleting pods.

## Features
- User authentication
- Deploy applications from GitHub repositories
- View and manage Kubernetes pods
- Display logs for each pod

## Project Structure
```
miragex-app
├── src
│   ├── app.ts                # Entry point of the application
│   ├── controllers           # Contains route controllers
│   │   └── index.ts          # Index controller for handling routes
│   ├── routes                # Contains route definitions
│   │   └── index.ts          # Sets up application routes
│   ├── types                 # Type definitions
│   │   └── index.ts          # TypeScript interfaces
│   └── main.ts               # Main logic for initializing the app
├── package.json              # npm configuration file
├── tsconfig.json             # TypeScript configuration file
└── README.md                 # Project documentation
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd miragex-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

## Usage
1. Start the application:
   ```
   npm start
   ```

2. Open your browser and navigate to `http://localhost:3000`.

## API Endpoints
- `GET /login`: Displays the login form.
- `POST /login`: Authenticates the user.
- `GET /`: Displays the main application interface.
- `POST /deploy`: Deploys a new application to Kubernetes.
- `GET /pods`: Lists all pods in the Kubernetes cluster.
- `GET /pods/:name/logs`: Displays logs for a specific pod.
- `GET /pods/:name/delete`: Deletes a specific pod.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.