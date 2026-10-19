const { GoogleGenerativeAI } = require('@google/generative-ai');

const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const client = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

module.exports = { client, modelName };
