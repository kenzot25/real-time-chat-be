import { Injectable } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async updateProfile(userId: number, fullname: string, avatarUrl: string) {
    if (avatarUrl) {
      const oldUser = await this.prismaService.user.findUnique({
        where: {
          id: userId,
        },
      });
      const updatedUser = await this.prismaService.user.update({
        where: { id: userId },
        data: {
          fullname,
          avatarUrl,
        },
      });

      if (oldUser.avatarUrl) {
        const imageName = oldUser.avatarUrl.split('/').pop();
        const imagePath = join(
          __dirname,
          '..',
          '..',
          'public',
          'images',
          imageName,
        );
        if (existsSync(imagePath)) {
          unlinkSync(imagePath);
        }
      }

      return updatedUser;
    }
    return await this.prismaService.user.update({
      where: { id: userId },
      data: {
        fullname,
      },
    });
  }
}
