export const createdOrderResponseSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    date: { type: 'string', format: 'date-time' },
    userId: { type: 'string', format: 'uuid' },
    orderDetail: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        price: { type: 'string', example: '329.98' },
      },
    },
  },
};

export const orderResponseSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    date: { type: 'string', format: 'date-time' },
    user: {
      type: 'object',
      nullable: true,
      properties: { id: { type: 'string', format: 'uuid' } },
    },
    orderDetail: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        price: { type: 'string', example: '329.98' },
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string', example: 'Iphone 15' },
              description: { type: 'string' },
              price: { type: 'string', example: '329.98' },
              stock: { type: 'integer', example: 12 },
              imgUrl: { type: 'string', format: 'url' },
            },
          },
        },
      },
    },
  },
};

export const orderListResponseSchema = {
  type: 'array' as const,
  items: orderResponseSchema,
};
