# PFControl v2

## Local Development Setup

Follow these steps to get PFControl v2 running locally for development:

---

### 1. Install Dependencies

Run the following command in the project root to install all required packages:

```
npm install
```

---

### 2. Create Environment File

Create a file named `.env.development` in the project root.
You can use `.env.example` as a template:

```
cp .env.example .env.development
```

Fill in the required environment variables in `.env.development`.
If you need values for secrets or database URLs, please contact Banana or Linuss.

---

### 3. Start Development Environment with Docker

Start the development environment:

```
npm run dev
```

## Accessing the App

-   **Frontend:** [http://localhost:5173](http://localhost:5173)
-   **Backend API:** [http://localhost:9901](http://localhost:9901)

---

**Note:**

-   For any issues or missing environment variables, reach out to the maintainers.

---