import express from "express";
import validate from "express-zod-safe";

import { authMiddleware, isOwnerMiddlewareComments } from "@/api/middleware/auth.middleware";
import { commentsIdSchema, commentsInsertSchema, commentsUpdateSchema } from "@/db/schema/comments";
import * as commentsRepository from "@/repository/comment.repository";
import * as userRepository from "@/repository/user.repository";
import passport from "@/utils/passport";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  validate({ body: commentsInsertSchema }),
  async (req, res) => {
    const comment = await commentsRepository.createComment({ ...req.body, userId: req.user!.id!, postId: req.body.postId });

    const author = await userRepository.getUserById(comment.userId);
    if (!author) {
      res.status(404).json({ message: "Autore non trovato." });
      return;
    }
    res.status(201).json({
      ...comment,
      author: {
        id: author.id,
        name: author.name,
        email: author.email,
      },
    });
  },
);

router.delete("/:id", passport.authenticate("jwt", { session: false }), async (req, res) => {
  const deleteComment = commentsIdSchema.safeParse(req.params);
  if (deleteComment.error || !deleteComment.data) {
    res.status(400).json(deleteComment.error);
    return;
  }
  const Comment = await commentsRepository.deleteComment(deleteComment.data.id);
  if (!Comment) {
    res.status(404).end();
    return;
  }

  res.json(Comment);
});

router.put("/:id", passport.authenticate("jwt", { session: false }), isOwnerMiddlewareComments, async (req, res) => {
  const putID = commentsIdSchema.safeParse(req.params);
  if (putID.error || !putID.data) {
    res.status(400).json(putID.error);
    return;
  }

  const putBody = commentsUpdateSchema.safeParse(req.body);
  if (putBody.error || !putBody.data) {
    res.status(400).json(putBody.error);
    return;
  }

  const updatedComment = await commentsRepository.updateComment(req.comments!.id, putBody.data);
  if (!updatedComment) {
    res.status(404).end();
    return;
  }

  res.json(updatedComment);
});

export default router;
