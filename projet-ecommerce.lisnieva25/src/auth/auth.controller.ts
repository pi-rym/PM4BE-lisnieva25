import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginUserDto, SignupUserDto } from './dto/auth.dto';
import {
  signInResponseSchema,
  signUpResponseSchema,
} from './schemas/auth.schemas';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 201, schema: signInResponseSchema })
  @ApiResponse({ status: 401, description: 'Correo o contraseña incorrectos' })
  signIn(@Body() loginUserDto: LoginUserDto) {
    return this.authService.signIn(loginUserDto);
  }

  @Post('signup')
  @ApiOperation({ summary: 'Registrar un usuario' })
  @ApiResponse({ status: 201, schema: signUpResponseSchema })
  signUp(@Body() signupUserDto: SignupUserDto) {
    return this.authService.signUp(signupUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar disponibilidad de autenticación',
  })
  @ApiResponse({ status: 200, description: 'Estado del módulo' })
  getStatus() {
    return this.authService.getStatus();
  }
}
