import { z } from 'zod'

// Auth Schemas
export const LoginResponseSchema = z.object({
    token: z.string().min(1, 'Token must be provided'),
    user: z.object({
        id: z.union([z.string(), z.number()]),
        username: z.string(),
        role: z.string(),
    }).optional(),
}).passthrough()

export const AuthUserSchema = z.object({
    id: z.union([z.string(), z.number()]),
    username: z.string(),
    role: z.string(),
}).passthrough()

// Product & Category Schemas
export const ProductSchema = z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
    price: z.number().min(0),
    category: z.string().optional(),
    image: z.string().optional(),
    stock: z.number().min(0).optional(),
}).passthrough()

export const CategorySchema = z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
}).passthrough()

export const CatalogSchema = z.object({
    categories: z.array(CategorySchema).default([]),
    products: z.array(ProductSchema).default([]),
}).passthrough()

// Order Schemas
export const OrderSchema = z.object({
    orderNumber: z.string(),
    items: z.array(z.object({
        productId: z.union([z.string(), z.number()]),
        quantity: z.number(),
        price: z.number(),
    }).passthrough()).default([]),
    total: z.number().min(0),
    status: z.string().optional(),
    createdAt: z.string().optional(),
}).passthrough()

export const OrderDetailSchema = OrderSchema

// Settings Schema
export const SettingsSchema = z.object({
    companyName: z.string().optional(),
    currency: z.string().optional(),
    taxRate: z.number().optional(),
}).passthrough()

// Users Schema
export const UserSchema = z.object({
    id: z.union([z.string(), z.number()]),
    username: z.string(),
    role: z.string(),
    email: z.string().optional(),
}).passthrough()

// Bootstrap Schema
export const BootstrapDataSchema = z.object({
    user: AuthUserSchema.optional(),
    settings: SettingsSchema.optional(),
}).passthrough()

// Public Customer Schemas
export const PublicCustomerSchema = z.object({
    id: z.union([z.string(), z.number()]),
    email: z.string().optional(),
    phone: z.string().optional(),
    addresses: z.array(z.object({
        id: z.union([z.string(), z.number()]),
        address: z.string(),
        lat: z.number().optional(),
        lng: z.number().optional(),
    }).passthrough()).default([]),
}).passthrough()

export const PublicPaymentConfigSchema = z.object({
    paymentMethods: z.array(z.string()).default([]),
    khqrEnabled: z.boolean().optional(),
}).passthrough()

// KHQR Schemas
export const KhqrResponseSchema = z.object({
    md5: z.string(),
    qrUrl: z.string().optional(),
}).passthrough()

export const KhqrStatusSchema = z.object({
    status: z.string(),
    isPaid: z.boolean().optional(),
    amount: z.number().optional(),
}).passthrough()

// Generic Response Wrapper
export const ApiResponseSchema = z.union([
    z.object({ error: z.string() }),
    z.object({ details: z.string() }),
    z.any(),
])
