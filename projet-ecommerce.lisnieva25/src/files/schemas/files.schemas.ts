export const uploadImageBodySchema = {
  type: 'object' as const,
  required: ['file'],
  properties: { file: { type: 'string', format: 'binary' } },
};
