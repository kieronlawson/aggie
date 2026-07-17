const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        "Set it in GitHub repository secrets (CI) or your local .env file — see .env.example."
    );
  }
  return value;
};

export { requireEnv };
