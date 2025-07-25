import { Kysely } from 'kysely';
import { IDb } from '../../../database/types/IDb';
import {
  UserEntity,
  NewUser,
  UpdateUser,
  KyselyUserEntity,
  QueryUser,
} from './user.entity';
import { BaseRepo, FindManyArgs } from '../../../shared/types/base/base.repo';
import { infinityPagination } from '../../../shared/utils/infinityPagination';
import { PostgresError } from '../../../shared/Errors/PostgresError';

export class UserRepository extends BaseRepo<KyselyUserEntity> {
  constructor(trx: Kysely<IDb>) {
    super(trx, 'users');
  }

  override async findManyWithPagination(query: QueryUser) {
    try {
      const queryBuilder = this.trx
        .selectFrom('users')
        .$if(!!query.filter, (q) =>
          q.where((eb) =>
            eb.and(
              query.filter?.map((arg) =>
                eb(arg.column, arg.operator, arg.value)
              ) || []
            )
          )
        )
        .$if(!!query.search, (q) =>
          q.where((e) =>
            e.or(
              query.search?.map((arg) =>
                e(arg.column, arg.operator, arg.value)
              ) || []
            )
          )
        );

      const [res, total] = await Promise.all([
        queryBuilder
          .$if(!!query.sort, (q) =>
            query.sort!.reduce(
              (qb, arg) => qb.orderBy(arg.orderBy, arg.sort),
              q
            )
          )
          .$if(!!query.limit, (q) => q.limit(query.limit as number))
          .$if(!!query.limit && !!query.page, (q) =>
            q.offset(((query.page as number) - 1) * (query.limit as number))
          )
          .selectAll('users')
          .execute(),
        queryBuilder
          .select(this.trx.fn.countAll('users').as('count'))
          .executeTakeFirst(),
      ]);
      return infinityPagination(res, {
        total_count: Number(total?.count ?? 0),
        page: query.page,
        limit: query.limit,
      });
    } catch (err) {
      throw new PostgresError(err);
    }
  }

  override async findOne(args: FindManyArgs<UserEntity>) {
    try {
      const res = await this.trx
        .selectFrom('users')
        .selectAll()
        .where((eb) =>
          eb.and(
            args.where.map((arg) => eb(arg.column, arg.operator, arg.value))
          )
        )
        .executeTakeFirst();
      return res ?? null;
    } catch (error) {
      throw new PostgresError(error);
    }
  }

  async create(data: NewUser) {
    try {
      const [inserted] = await this.trx
        .insertInto('users')
        .values(data)
        .returningAll()
        .execute();
      return inserted;
    } catch (error) {
      throw new PostgresError(error);
    }
  }

  async update(id: string, data: UpdateUser) {
    try {
      const [updated] = await this.trx
        .updateTable('users')
        .set(data)
        .where('id', '=', id)
        .returningAll()
        .execute();
      return updated;
    } catch (error) {
      throw new PostgresError(error);
    }
  }

  async delete(id: string) {
    try {
      await this.trx.deleteFrom('users').where('id', '=', id).execute();
    } catch (error) {
      throw new PostgresError(error);
    }
  }
}
