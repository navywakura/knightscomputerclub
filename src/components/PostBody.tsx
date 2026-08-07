import { renderPostBody } from "@/lib/markdown";

export default function PostBody({ body }: { body: string }) {
  return <div className="post-body">{renderPostBody(body)}</div>;
}
