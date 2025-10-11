import { UnifiedPluginModel } from "@core/ui/settings/pages/Plugins/models";
import { lazyDestructure } from "@lib/utils/lazy";
import { findByNameLazy, findByProps } from "@metro";
import { FluxUtils } from "@metro/common";
import { Avatar, AvatarPile, Text } from "@metro/common/components";
import { UserStore } from "@metro/common/stores";
import { View, TouchableOpacity } from "react-native";

const showUserProfileActionSheet = findByNameLazy("showUserProfileActionSheet");
const { getUser: maybeFetchUser } = lazyDestructure(() =>
  findByProps("getUser", "fetchProfile"),
);

export default function TitleComponent({
  plugin,
}: {
  plugin: UnifiedPluginModel;
}) {
  const users: any[] = FluxUtils.useStateFromStoresArray([UserStore], () => {
    plugin.authors?.forEach((a) => a.id && maybeFetchUser(a.id));
    return plugin.authors?.map((a) => UserStore.getUser(a.id));
  });

  const { authors } = plugin;
  const authorTextNode = [];

  if (authors) {
    for (const author of authors) {
      authorTextNode.push(
        <Text variant="text-md/medium" key={author.name}>
          {author.name}
        </Text>,
      );

      authorTextNode.push(", ");
    }

    authorTextNode.pop();
  }

  const openFirstAuthorProfile = () => {
    // Find first author with ID
    const authorWithId = authors?.find((a) => !!a.id);
    if (authorWithId?.id) {
      showUserProfileActionSheet({ userId: authorWithId.id });
    }
  };

  return (
    <View style={{ gap: 4 }}>
      <View>
        <Text variant="heading-xl/semibold">{plugin.name}</Text>
      </View>
      <View style={{ flexDirection: "row", flexShrink: 1 }}>
        {authors?.length && (
          <TouchableOpacity
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              paddingVertical: 4,
              paddingHorizontal: 8,
              backgroundColor: "#00000016",
              borderRadius: 32,
            }}
            onPress={
              authors.some((a) => !!a.id) ? openFirstAuthorProfile : undefined
            }
            disabled={!authors.some((a) => !!a.id)}
          >
            {users.length && (
              <AvatarPile
                size="xxsmall"
                names={plugin.authors?.map((a) => a.name)}
                totalCount={plugin.authors?.length}
              >
                {users.map((a) => (
                  <Avatar size="xxsmall" user={a} />
                ))}
              </AvatarPile>
            )}
            <Text variant="text-md/medium">{authorTextNode}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
