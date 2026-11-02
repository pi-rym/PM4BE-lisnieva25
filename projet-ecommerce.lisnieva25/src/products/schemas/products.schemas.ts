export const productIdResponseSchema = {
  type: 'object' as const,
  properties: { id: { type: 'string', format: 'uuid' } },
};
