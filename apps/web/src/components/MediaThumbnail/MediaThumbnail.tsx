import { Center, Image, Paper } from "@mantine/core";
import { LuImage, LuVideo } from "react-icons/lu";
import type { MediaAsset } from "../../models/media.models";

type Props = {
  asset: Pick<MediaAsset, "kind" | "previewUrl">;
  width: number;
  height: number;
};

/** Shows a still image or recognizable fallback without mounting video. */
export const MediaThumbnail = ({ asset, width, height }: Props) =>
  asset.previewUrl ? (
    <Image
      src={asset.previewUrl}
      alt=""
      w={width}
      h={height}
      fit="cover"
      radius="sm"
    />
  ) : (
    <Paper
      withBorder
      w={width}
      h={height}
      radius="sm"
      aria-label={
        asset.kind === "video"
          ? "Video thumbnail unavailable"
          : "Image thumbnail unavailable"
      }
    >
      <Center h="100%" c="dimmed">
        {asset.kind === "video" ? <LuVideo size={20} /> : <LuImage size={20} />}
      </Center>
    </Paper>
  );
