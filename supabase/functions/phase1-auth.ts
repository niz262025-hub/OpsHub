export const handler = async () => {
  return new Response(
    JSON.stringify({
      message: 'Phase 1 auth and seller verification foundation is in place.',
      notes: ['No secrets are exposed.', 'No marketplace logic is implemented.'],
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
