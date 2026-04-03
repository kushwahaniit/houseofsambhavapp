import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: 'Netlify Functions'
    })
  };
};
