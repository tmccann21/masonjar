const getenv = (name: string, required: boolean, defaultValue?: string): string => {
  const value = process.env[name];

  if (value === undefined && required)
    throw new Error(`could not find required env var ${name}`);
  else if (value === undefined && !required)
    return defaultValue;

  return value;
}

export default getenv;