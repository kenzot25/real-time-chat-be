import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async updateProfile(userId: number, fullname: string, avatarUrl: string) {
    if (avatarUrl) {
      return await this.prismaService.user.update({
        where: { id: userId },
        data: {
          fullname,
          avatarUrl,
        },
      });
    }
    return await this.prismaService.user.update({
      where: { id: userId },
      data: {
        fullname,
      },
    });
  }
}
