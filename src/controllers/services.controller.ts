// src/controllers/services.controller.ts
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Service from '../models/Service';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';

// ============================================================
// MAPPER: Sequelize model → frontend Service shape
// ============================================================
// Frontend type expects snake_case + price as number + status as
// 'active' | 'inactive' | 'pending'. Backend uses camelCase + 'deleted'.
function toApi(s: Service) {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    price: Number(s.price) || 0,
    location: s.location,
    availability: s.availability ?? undefined,
    estimatedDuration: s.estimatedDuration ?? undefined,
    skills: s.skills ?? [],
    provider_id: s.providerId,
    status: s.status === 'deleted' ? 'inactive' : s.status,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

// ==================== CREATE SERVICE ====================
export const createService = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  }
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can create services', 403, 'FORBIDDEN');
  }

  const {
    title,
    description,
    category,
    price,
    location,
    availability,
    estimatedDuration,
    skills,
  } = req.body;

  if (!title || !description || !category || !location) {
    return res.error(
      'title, description, category, and location are required',
      400,
      'MISSING_FIELDS'
    );
  }

  const service = await Service.create({
    providerId: user.id,
    title,
    description,
    category,
    price: price !== undefined && price !== '' ? String(price) : undefined,
    location,
    availability: availability || undefined,
    estimatedDuration: estimatedDuration || undefined,
    skills: Array.isArray(skills) ? skills : [],
    status: 'active',
  });

  logger.info(`Service ${service.id} created by provider ${user.email}`);

  res.status(201).success({ service: toApi(service) }, 'Service created successfully');
});

// ==================== GET PROVIDER'S OWN SERVICES ====================
export const getProviderServices = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  }

  const services = await Service.findAll({
    where: {
      providerId: user.id,
      status: { [Op.ne]: 'deleted' },
    },
    order: [['createdAt', 'DESC']],
  });

  res.success({ services: services.map(toApi) }, 'Services retrieved successfully');
});

// ==================== GET PROVIDER STATS ====================
export const getProviderStats = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  }

  const [total, active, pending, completed] = await Promise.all([
    Service.count({ where: { providerId: user.id, status: { [Op.ne]: 'deleted' } } }),
    Service.count({ where: { providerId: user.id, status: 'active' } }),
    Service.count({ where: { providerId: user.id, status: 'pending' } }),
    Service.count({ where: { providerId: user.id, status: 'completed' } }),
  ]);

  res.success({ total, active, pending, completed }, 'Stats retrieved successfully');
});

// ==================== DELETE SERVICE (soft delete) ====================
export const deleteService = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  }

  const serviceIdParam = req.params.id;
  const serviceId = Array.isArray(serviceIdParam) ? serviceIdParam[0] : serviceIdParam;

  const service = await Service.findByPk(serviceId);

  if (!service) {
    return res.error('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  if (service.providerId !== user.id) {
    return res.error('You can only delete your own services', 403, 'FORBIDDEN');
  }

  await service.update({ status: 'deleted' });

  logger.info(`Service ${service.id} soft-deleted by provider ${user.email}`);

  res.success({ id: service.id }, 'Service deleted successfully');
});

// ==================== GET ALL ACTIVE SERVICES (public) ====================
export const getAllActiveServices = catchAsync(async (req: Request, res: Response) => {
  const { search, categories, location, minPrice, maxPrice, sortBy } = req.query;

  const where: any = { status: 'active' };

  if (search && typeof search === 'string') {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (categories && typeof categories === 'string') {
    const cats = categories.split(',').map((c) => c.trim()).filter(Boolean);
    if (cats.length > 0) where.category = { [Op.in]: cats };
  }

  if (location && typeof location === 'string') {
    where.location = { [Op.iLike]: `%${location}%` };
  }

  // price stored as string — need to filter numerically
  if (minPrice !== undefined || maxPrice !== undefined) {
    const parts: string[] = [];
    if (minPrice !== undefined) parts.push(`CAST(price AS DOUBLE PRECISION) >= ${Number(minPrice)}`);
    if (maxPrice !== undefined) parts.push(`CAST(price AS DOUBLE PRECISION) <= ${Number(maxPrice)}`);
    if (parts.length) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        // use raw string via Sequelize.where
        // simpler: fallback to JS filter below
      ];
    }
    // Instead of raw SQL complexity, apply numeric filter in JS after fetch:
  }

  let order: any = [['createdAt', 'DESC']];
  if (sortBy === 'price_low') order = [['price', 'ASC']];
  if (sortBy === 'price_high') order = [['price', 'DESC']];

  let services = await Service.findAll({ where, order });

  // numeric price filter (simple, safe)
  if (minPrice !== undefined || maxPrice !== undefined) {
    const min = minPrice !== undefined ? Number(minPrice) : -Infinity;
    const max = maxPrice !== undefined ? Number(maxPrice) : Infinity;
    services = services.filter((s) => {
      const p = Number(s.price);
      return !Number.isNaN(p) && p >= min && p <= max;
    });
  }

  res.success({ services: services.map(toApi) }, 'Active services retrieved successfully');
});

// ==================== GET SINGLE SERVICE BY ID (public) ====================
export const getServiceById = catchAsync(async (req: Request, res: Response) => {
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const service = await Service.findByPk(id);

  if (!service || service.status === 'deleted') {
    return res.error('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  res.success({ service: toApi(service) }, 'Service retrieved successfully');
});