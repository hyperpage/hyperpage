import promClient from "prom-client";

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

export default register;
