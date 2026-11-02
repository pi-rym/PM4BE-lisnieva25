export const userProfileResponseSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    phone: { type: 'integer' },
    country: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    orders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

export const userListResponseSchema = {
  ...userProfileResponseSchema,
  properties: {
    ...userProfileResponseSchema.properties,
    admin: {
      type: 'boolean',
      description: 'Indica si el usuario es administrador',
    },
  },
};

export const usersListResponseSchema = {
  type: 'array' as const,
  items: userListResponseSchema,
};

export const deleteUserResponseSchema = {
  type: 'object' as const,
  properties: { message: { type: 'string', example: 'Usuario eliminado' } },
};
