//backend/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>
  ) {}
  async findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }
  async findOrCreateByEmail(email: string) {
    let user = await this.usersRepo.findOne({ where: { email } });
    if (!user) {
      user = this.usersRepo.create({ email, status: 'inactive' });
      user = await this.usersRepo.save(user);
    }
    return user;
  }
  async setStatus(userId: string, status: User['status']) {
    await this.usersRepo.update({ id: userId }, { status });
  }
  async listAll() {
    return this.usersRepo.find();
  }
}