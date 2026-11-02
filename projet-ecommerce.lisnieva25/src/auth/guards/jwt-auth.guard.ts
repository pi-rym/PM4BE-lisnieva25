import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Role } from '../roles/roles';

export interface AuthenticatedUser {
  id: string;
  role?: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser & { exp: number; expiresAt: Date };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        role?: string;
        exp?: number;
      }>(token);
      
      if (!payload.sub || !payload.exp) throw new Error('Token inválido');
      request.user = {
        id: payload.sub,
        ...(payload.role === Role.Admin ? { role: Role.Admin } : {}),
        exp: payload.exp,
        expiresAt: new Date(payload.exp * 1000),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
