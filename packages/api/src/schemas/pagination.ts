import { z } from "zod";

export const paginationCursorSchema = z.string().min(1);
