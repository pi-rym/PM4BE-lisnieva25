export const signUpResponseSchema = {
  type: 'object' as const,
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', message: 'ingresa un nombre' },
        email: { type: 'string', format: 'email', example: 'ana@correo.com' },
        phone: { type: 'number', message: 'ingresa un numero de celular' },
        country: { type: 'string', message: 'ingresa un país' },
        address: { type: 'string', message: 'ingresa una dirección' },
        city: { type: 'string', message: 'ingresa una ciudad' },
      },
    },
    accessToken: { type: 'string', description: 'Token válido por una hora' },
  },
};

export const signInResponseSchema = {
  type: 'object' as const,
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email', example: 'ana@correo.com' },
      },
    },
    accessToken: { type: 'string', description: 'Token válido por una hora' },
  },
};
