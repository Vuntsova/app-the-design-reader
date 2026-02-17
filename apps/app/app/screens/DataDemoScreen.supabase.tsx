/**
 * DataDemoScreen - Supabase Version
 *
 * This screen demonstrates proper data fetching patterns with Supabase:
 * - React Query for data fetching and caching
 * - Direct Supabase SDK usage for queries
 * - Optimistic updates with mutation
 * - Loading and error states
 *
 * Copy this pattern for your own data-fetching screens with Supabase.
 */

import { FC, memo, useCallback, useState } from "react"
import { View, FlatList } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text, Button, Card, TextField, Spinner, EmptyState, Screen } from "@/components"
import { useAuth } from "@/hooks"
import { supabase } from "@/services/supabase"

// =============================================================================
// TYPES
// =============================================================================

interface Post {
  id: string
  title: string
  content: string
  author_id: string
  created_at: string
}

interface PostListItemProps {
  item: Post
  currentUserId: string | null
  onDelete: (postId: string) => void
  deleteColor: string
}

const PostListItem = memo(function PostListItem({
  item,
  currentUserId,
  onDelete,
  deleteColor,
}: PostListItemProps) {
  return (
    <Card
      style={styles.postCard}
      ContentComponent={
        <>
          <View style={styles.postHeader}>
            <Text preset="subheading" style={styles.postTitle}>
              {item.title}
            </Text>
            {item.author_id === currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => onDelete(item.id)}
                LeftAccessory={() => (
                  <Ionicons name="trash-outline" size={16} color={deleteColor} />
                )}
              />
            )}
          </View>
          <Text style={styles.postContent}>{item.content}</Text>
          <Text preset="caption" style={styles.postDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </>
      }
    />
  )
})

// =============================================================================
// DATA FETCHING WITH REACT QUERY + SUPABASE
// =============================================================================

/**
 * Fetch posts from Supabase
 * Uses React Query for caching and refetching
 * Note: You need to create a "posts" table in your Supabase database with columns:
 * - id: uuid (primary key)
 * - title: text
 * - content: text
 * - author_id: uuid (foreign key to auth.users)
 * - created_at: timestamptz
 */
const usePosts = () => {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) throw error
      return data as Post[]
    },
  })
}

/**
 * Create a new post
 * Uses mutation with optimistic updates
 */
const useCreatePost = () => {
  const queryClient = useQueryClient()
  const { userId } = useAuth()

  return useMutation({
    mutationFn: async (newPost: { title: string; content: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("posts")
        .insert({
          ...newPost,
          author_id: userId,
        })
        .select()
        .single()

      if (error) throw error
      return data as Post
    },
    // Optimistic update
    onMutate: async (newPost) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] })
      const previousPosts = queryClient.getQueryData<Post[]>(["posts"])

      queryClient.setQueryData<Post[]>(["posts"], (old) => [
        {
          id: `temp-${Date.now()}`,
          ...newPost,
          author_id: userId ?? "",
          created_at: new Date().toISOString(),
        },
        ...(old ?? []),
      ])

      return { previousPosts }
    },
    onError: (_err, _newPost, context) => {
      // Rollback on error
      queryClient.setQueryData(["posts"], context?.previousPosts)
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    },
  })
}

/**
 * Delete a post
 */
const useDeletePost = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("posts").delete().eq("id", postId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    },
  })
}

// =============================================================================
// COMPONENT
// =============================================================================

export const DataDemoScreen: FC = () => {
  const { theme } = useUnistyles()
  const { user } = useAuth()

  // Form state
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  // Data fetching hooks
  const { data: posts, isLoading, error, refetch, isRefetching } = usePosts()
  const createPost = useCreatePost()
  const deletePost = useDeletePost()

  const handleCreatePost = useCallback(async () => {
    if (!title.trim() || !content.trim()) return

    try {
      await createPost.mutateAsync({ title, content })
      setTitle("")
      setContent("")
    } catch {
      // Error handled by React Query
    }
  }, [content, createPost, title])

  const handleDeletePost = useCallback(
    (postId: string) => {
      deletePost.mutate(postId)
    },
    [deletePost],
  )

  const keyExtractor = useCallback((item: Post) => item.id, [])

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostListItem
        item={item}
        currentUserId={user?.id ?? null}
        onDelete={handleDeletePost}
        deleteColor={theme.colors.error}
      />
    ),
    [handleDeletePost, theme.colors.error, user?.id],
  )

  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  if (isLoading) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Spinner size="lg" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      </Screen>
    )
  }

  if (error) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <View style={styles.centered}>
          <EmptyState
            preset="error"
            heading="Failed to load posts"
            content={error.message}
            button="Retry"
            buttonOnPress={handleRefresh}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text preset="heading">Data Demo (Supabase)</Text>
          <Text preset="caption" style={styles.subtitle}>
            React Query + Supabase SDK
          </Text>
        </View>

        {/* Create Post Form */}
        <Card
          style={styles.formCard}
          ContentComponent={
            <>
              <Text preset="subheading" style={styles.formTitle}>
                Create Post
              </Text>
              <TextField
                placeholder="Title"
                value={title}
                onChangeText={setTitle}
                style={styles.input}
              />
              <TextField
                placeholder="Content"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={3}
                style={styles.input}
              />
              <Button
                text="Create Post"
                variant="filled"
                onPress={handleCreatePost}
                disabled={createPost.isPending || !title.trim() || !content.trim()}
                loading={createPost.isPending}
              />
            </>
          }
        />

        {/* Posts List */}
        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={isRefetching}
          ListEmptyComponent={
            <EmptyState
              icon="components"
              heading="No posts yet"
              content="Create your first post above"
            />
          }
        />
      </View>
    </Screen>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  subtitle: {
    color: theme.colors.foregroundSecondary,
    marginTop: theme.spacing.xs,
  },
  formCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  formTitle: {
    marginBottom: theme.spacing.md,
  },
  input: {
    marginBottom: theme.spacing.sm,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
  postCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postTitle: {
    flex: 1,
  },
  postContent: {
    color: theme.colors.foregroundSecondary,
    marginVertical: theme.spacing.sm,
  },
  postDate: {
    color: theme.colors.foregroundTertiary,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.foregroundSecondary,
  },
}))
