import type { Database } from './database.generated'

/** Handy aliases over the generated schema types (public schema). */
type Pub = Database['public']

/** A row as read from table or view `T`. */
export type Row<T extends keyof (Pub['Tables'] & Pub['Views'])> = (Pub['Tables'] & Pub['Views'])[T] extends {
  Row: infer R
}
  ? R
  : never

/** The object to pass when inserting into table `T`. */
export type InsertOf<T extends keyof Pub['Tables']> = Pub['Tables'][T]['Insert']

/** Arguments of RPC function `F`. */
export type RpcArgs<F extends keyof Pub['Functions']> = Pub['Functions'][F]['Args']

/** Return type of RPC function `F`. */
export type RpcReturns<F extends keyof Pub['Functions']> = Pub['Functions'][F]['Returns']
