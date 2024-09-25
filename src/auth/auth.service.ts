import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { User } from 'src/user/types';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async refreshToken(req: Request, res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    let payload;

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userExists = await this.prismaService.user.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!userExists) {
      throw new BadRequestException('User no longer exists');
    }

    const expiredIn = 15000;
    const expiration = Math.floor(Date.now() / 1000) + expiredIn;

    const accessToken = this.jwtService.sign(
      { ...payload, expiresIn: expiration },
      {
        secret: this.configService.get('ACCESS_TOKEN_SECRET'),
      },
    );

    res.cookie('access_token', accessToken, { httpOnly: true });
  }

  private async issueTokens(user: User, res: Response) {
    const payload = { username: user.fullname, sub: user.id };
    const accessToken = this.jwtService.sign(
      { ...payload },
      {
        secret: this.configService.get('ACCESS_TOKEN_SECRET'),
        expiresIn: '150sec',
      },
    );
    const refreshToken = this.jwtService.sign(
      { ...payload },
      {
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
        expiresIn: '7d',
      },
    );
    res.cookie('access_token', accessToken, { httpOnly: true });
    res.cookie('refresh_token', refreshToken, { httpOnly: true });
    return { user };
  }

  async validateUser(loginDto: LoginDto) {
    try {
      const user = await this.prismaService.user.findUnique({
        where: {
          email: loginDto.email,
        },
      });
      console.log({ user });
      const isValid = await bcrypt.compare(loginDto.password, user.password);
      if (isValid) return user;
      else throw new UnauthorizedException();
    } catch (err) {
      throw new UnauthorizedException('Credentials is not valid.');
    }
  }

  async register(registerDto: RegisterDto, res: Response) {
    const exitingUser = await this.prismaService.user.findUnique({
      where: {
        email: registerDto.email,
      },
    });
    if (exitingUser) {
      throw new UnprocessableEntityException('Email already exits');
    }

    const newUser = await this.prismaService.user.create({
      data: {
        fullname: registerDto.fullname,
        email: registerDto.email,
        password: await bcrypt.hash(registerDto.password, 10),
      },
    });

    return this.issueTokens(newUser, res);
  }

  async login(loginDto: LoginDto, response: Response) {
    console.log({ loginDto });
    const user = await this.validateUser(loginDto);
    if (!user) {
      throw new BadRequestException({
        invalidCredentials: 'Invalid credentials',
      });
    }
    return this.issueTokens(user, response);
  }

  async logout(response: Response) {
    response.clearCookie('access_token');
    response.clearCookie('refresh_token');
    return 'Successfully logged out';
  }
}
